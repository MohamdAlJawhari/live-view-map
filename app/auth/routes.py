from flask import render_template, request, redirect, url_for
from flask_login import login_user, logout_user, login_required
from werkzeug.security import check_password_hash

from extensions import login_manager
from models import User

from . import bp


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


@bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        user = User.query.filter_by(username=request.form["username"]).first()

        if user and check_password_hash(user.password, request.form["password"]):
            login_user(user)
            return redirect(url_for("news.admin_news"))

        return "Invalid credentials"

    return render_template("login.html")


@bp.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("auth.login"))
