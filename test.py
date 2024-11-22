# app.py
from flask import Flask

app = Flask(__name__)

@app.route('/')
def home():
    return "Hello, this is an endpoint exposed on port 9000!"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9000)
