from flask import Flask, redirect, send_from_directory

app = Flask(__name__)


@app.route("/")
def home_page():
    # The main address shows the homepage.
    return send_from_directory("home", "index.html")


@app.route("/home/<path:filename>")
def home_files(filename):
    # Files that live in the home folder, such as /home/style.css.
    return send_from_directory("home", filename)


@app.route("/style.css")
def home_style():
    # index.html links to style.css with a relative path.
    # From /, the browser asks for /style.css, which is this same file.
    return send_from_directory("home", "style.css")


@app.route("/script.js")
def home_script():
    # index.html links to script.js with a relative path.
    # From /, the browser asks for /script.js, which is this same file.
    return send_from_directory("home", "script.js")


@app.route("/game")
def game_redirect():
    # /game becomes /game/ so the game's relative CSS and JS paths work.
    return redirect("/game/")


@app.route("/game/")
def game_page():
    # The game page.
    return send_from_directory("game", "index.html")


@app.route("/game/<path:filename>")
def game_files(filename):
    # CSS and JavaScript that belong to the game.
    return send_from_directory("game", filename)


@app.route("/portfolio")
def portfolio_redirect():
    # /portfolio becomes /portfolio/ so its relative asset paths work.
    return redirect("/portfolio/")


@app.route("/portfolio/")
def portfolio_page():
    # The portfolio page.
    return send_from_directory("portfolio", "index.html")


@app.route("/portfolio/<path:filename>")
def portfolio_files(filename):
    # CSS, JavaScript, and images that belong to the portfolio.
    return send_from_directory("portfolio", filename)


@app.route("/api")
def api_redirect():
    # /api becomes /api/ so the future page's relative paths will work.
    return redirect("/api/")


@app.route("/api/")
def api_page():
    # The Tomb of Knowledge page. This file will be added in api/ later.
    return send_from_directory("api", "index.html")


@app.route("/api/<path:filename>")
def api_files(filename):
    # CSS, JavaScript, and other files for the future API page.
    return send_from_directory("api", filename)


@app.route("/embedded")
def embedded_redirect():
    # /embedded becomes /embedded/ so its relative asset paths work.
    return redirect("/embedded/")


@app.route("/embedded/")
def embedded_page():
    # The PWM Robotic Arm and Colour Choreographer page.
    return send_from_directory("embedded", "index.html")


@app.route("/embedded/<path:filename>")
def embedded_files(filename):
    # CSS, JavaScript, and other files for the embedded page.
    return send_from_directory("embedded", filename)


if __name__ == "__main__":
    app.run(debug=True)
