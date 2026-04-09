from flask import Flask, session
from config import Config
from extensions import db, login_manager


def create_app(config_class=Config):
    app = Flask(
        __name__,
        template_folder="../templates",
        static_folder="../static",
    )
    app.config.from_object(config_class)

    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"

    from app.main import bp as main_bp
    from app.news import bp as news_bp
    from app.polygons import bp as polygons_bp
    from app.auth import bp as auth_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(news_bp)
    app.register_blueprint(polygons_bp)
    app.register_blueprint(auth_bp)

    @app.context_processor
    def inject_ui_settings():
        return {
            "use_clustering": session.get(
                "use_clustering",
                app.config.get("USE_CLUSTERING", True),
            )
        }

    return app
