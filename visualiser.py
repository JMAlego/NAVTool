#!/usr/bin/env python3
"""PuckComm analysis visualiser."""

from argparse import ArgumentParser
from os import path

from flask import Flask, render_template
from flask_socketio import SocketIO, emit

from .protocols import get_protocols

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
socketio = SocketIO(app)

ROUTE_GRAPH = EVENT_LOG = SLOT_TABLE = None


def main():
    """Entry point."""
    global ROUTE_GRAPH, EVENT_LOG, SLOT_TABLE
    argument_parser = ArgumentParser()
    argument_parser.add_argument("data")
    parsed_args = argument_parser.parse_args()

    if path.isabs(parsed_args.data):
        data_path = path.abspath(parsed_args.data)
    else:
        data_path = path.abspath(path.join(path.dirname(__file__), parsed_args.data))

    protocols = get_protocols()

    for protocol in protocols.values():
        protocol.routes(app, data_path)

    @app.route('/')
    def index():
        """Protocol selection."""
        return render_template('index.html', protocols=protocols)

    socketio.run(app, debug=True)


if __name__ == '__main__':
    main()
