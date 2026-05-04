from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import sqlite3
import hashlib
import os

app = Flask(__name__)
app.secret_key = "supersecretkey123"
DB = "database.db"

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            category TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT NOT NULL,
            date TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

@app.route("/")
def home():
    if "user_id" in session:
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = hash_password(request.form["password"])
        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE username=? AND password=?", (username, password)).fetchone()
        conn.close()
        if user:
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            return redirect(url_for("dashboard"))
        return render_template("login.html", error="Invalid username or password!")
    return render_template("login.html")

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"]
        password = hash_password(request.form["password"])
        try:
            conn = get_db()
            conn.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
            conn.commit()
            conn.close()
            return redirect(url_for("login"))
        except:
            return render_template("register.html", error="Username already exists!")
    return render_template("register.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/dashboard")
def dashboard():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("dashboard.html", username=session["username"])

@app.route("/api/transactions", methods=["GET"])
def get_transactions():
    if "user_id" not in session:
        return jsonify([])
    conn = get_db()
    txs = conn.execute("SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC", (session["user_id"],)).fetchall()
    conn.close()
    return jsonify([dict(t) for t in txs])

@app.route("/api/transactions", methods=["POST"])
def add_transaction():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data = request.get_json()
    conn = get_db()
    conn.execute("INSERT INTO transactions (user_id, type, category, amount, description, date) VALUES (?,?,?,?,?,?)",
        (session["user_id"], data["type"], data["category"], float(data["amount"]), data["description"], data["date"]))
    conn.commit()
    conn.close()
    return jsonify({"message": "Added"}), 201

@app.route("/api/transactions/<int:tid>", methods=["DELETE"])
def delete_transaction(tid):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db()
    conn.execute("DELETE FROM transactions WHERE id=? AND user_id=?", (tid, session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"message": "Deleted"})

@app.route("/api/summary")
def summary():
    if "user_id" not in session:
        return jsonify({})
    conn = get_db()
    txs = conn.execute("SELECT * FROM transactions WHERE user_id=?", (session["user_id"],)).fetchall()
    conn.close()
    income  = sum(t["amount"] for t in txs if t["type"] == "income")
    expense = sum(t["amount"] for t in txs if t["type"] == "expense")
    cats = {}
    for t in txs:
        if t["type"] == "expense":
            cats[t["category"]] = cats.get(t["category"], 0) + t["amount"]
    return jsonify({"income": income, "expense": expense, "balance": income - expense, "categories": cats})

if __name__ == "__main__":
    init_db()
    app.run(debug=True)