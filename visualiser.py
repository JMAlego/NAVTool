#!/usr/bin/env python3
"""PuckComm analysis visualiser."""

from argparse import ArgumentParser
from json import dumps
from os import path

from flask import Flask, jsonify, render_template, request, send_from_directory
from flask_socketio import SocketIO, emit

from .protocols.airtight import RouteGraph, AirtightLog, AirtightSlotTable

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

    data_path = path.abspath(parsed_args.data)

    ROUTE_GRAPH = RouteGraph.from_file(path.join(data_path, "routes.txt"))
    EVENT_LOG = AirtightLog.from_file(path.join(data_path, "data.log"))
    SLOT_TABLE = AirtightSlotTable.from_file(path.join(data_path, "slot_table.txt"))

    socketio.run(app, debug=True)

@app.route('/')
def index():
    """Protocol selection."""
    return render_template('index.html')

# TODO: Need to move some of these handlers to submodules, flask makes this a bit hard but it is doable

@app.route('/airtight/<path:path>')
def send_airtight_static(path):
    """Send static airtight files."""
    return send_from_directory('static/airtight', path)

@app.route('/airtight')
def airtight():
    """Airtight UI."""
    return render_template('airtight.html')


@app.route("/airtight/graph.json")
def airtight_graph():
    """Airtight graph."""
    return jsonify(ROUTE_GRAPH.to_dict())


@app.route("/airtight/slot_table.json")
def airtight_slot_table():
    """Airtight slot table."""
    return jsonify(SLOT_TABLE.to_dict())


@app.route("/airtight/info.json")
def airtight_info():
    """Airtight slot table."""
    return jsonify({"slot_length": 100})

@app.route("/airtight/log.json")
def airtight_log():
    """Airtight log."""
    filter_range = request.args.get("range")
    filter_type = request.args.get("type")
    shape = request.args.get("shape")
    if shape == "linear":
        return jsonify(EVENT_LOG.to_list())
    else:
        return jsonify(EVENT_LOG.to_dict())

# TODO: Make use of websockets support for live data streaming.


if __name__ == '__main__':
    main()
