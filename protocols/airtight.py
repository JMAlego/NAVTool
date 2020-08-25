#!/usr/bin/env python3
"""Provides AirTight specific implementations."""

from collections import OrderedDict
from dataclasses import dataclass
from enum import Enum
from functools import partial
from itertools import permutations
from os import path
from typing import Dict, List, Union

from flask import Flask, jsonify, render_template, request, send_from_directory

from ..logs import Entry, EntryDictType, read_log_file, read_log_files

PROTOCOL_PATH = "airtight"
PROTOCOL_NAME = "AirTight"


class RouteGraph:
    """An Airtight Route graph."""

    def __init__(self):
        """Initialise the graph."""
        self._node_ids = set()
        self._hops = dict()
        self._routes = dict()

    def add_node(self, node_id: int):
        """Add a node to the route graph."""
        self._node_ids.add(node_id)

    def add_hop(self, current_node, destination_node, next_hop_node):
        """Add a hop to the route graph."""
        if current_node not in self._routes.keys():
            self._routes[current_node] = set()
        self._routes[current_node].add(destination_node)

        hop_id = (current_node, destination_node)
        self._hops[hop_id] = next_hop_node

    def can_route(self, source_node, destination_node):
        """Can a route be made between the two nodes."""
        return destination_node in self._routes[source_node]

    def next_hop(self, current_node, destination_node):
        """Get next hop for destination."""
        hop_id = (current_node, destination_node)
        return self._hops[hop_id] if hop_id in self._hops else None

    def to_dict(self):
        """Get dictionary representation."""

        def make_node(x):
            return {"group": "nodes", "data": {"id": "n{}".format(x)}}

        def make_edges(x):
            edge_id, hop_info = x
            route_start, route_end = hop_info
            return {
                "group": "edges",
                "data": {
                    "id": "e{}".format(edge_id),
                    "source": "n{}".format(route_start),
                    "target": "n{}".format(route_end)
                }
            }

        hops = {(x[0][0], x[1]) for x in self._hops.items()}
        for hop_id in permutations(self._node_ids, 2):
            if hop_id not in self._hops:
                hops.add(hop_id)

        return {
            "nodes": list(map(make_node, self._node_ids)),
            "edges": list(map(make_edges, enumerate(hops)))
        }

    @staticmethod
    def from_file(file: str) -> "RouteGraph":
        """Generate a new graph from a route file."""
        new_graph = RouteGraph()
        with open(file, "r") as file_handle:
            for line in file_handle:
                line = line.strip().upper()
                if line.startswith("HOP"):
                    node_id, destination_id, next_hop_id = map(
                        int, map(str.strip, line[line.index("(") + 1:line.index(")")].split(",")))
                    new_graph.add_node(node_id)
                    new_graph.add_node(destination_id)
                    new_graph.add_node(next_hop_id)
                    new_graph.add_hop(node_id, destination_id, next_hop_id)
        return new_graph


@dataclass
class AirtightPacket:
    """An Airtight packet."""

    priority: int = 0
    criticality: int = 0
    flow_id: int = 0
    source: int = 0
    destination: int = 0
    hop_source: int = 0
    hop_destination: int = 0
    c_value: int = 0
    sequence_number: int = 0
    data: bytes = bytes()

    @staticmethod
    def from_hex(hex_string: str) -> "AirtightPacket":
        """Get a new packet from a hex string."""
        new_packet = AirtightPacket()

        chunked = tuple(
            map(lambda x: int(x, 16), map("".join, zip(hex_string[::2], hex_string[1::2]))))

        if len(chunked) < 9:
            raise Exception("Malformed packet: too short")

        new_packet.priority = chunked[0]
        new_packet.criticality = chunked[1]
        new_packet.flow_id = chunked[2]
        new_packet.source = chunked[3]
        new_packet.destination = chunked[4]
        new_packet.hop_source = chunked[5]
        new_packet.hop_destination = chunked[6]
        new_packet.c_value = chunked[7]
        new_packet.sequence_number = chunked[8]
        new_packet.data = bytes(chunked[9:])

        return new_packet

    def to_dict(self) -> Dict[str, Union[int, str]]:
        """Convert to JSON a friendly dictionary."""
        return {
            "priority": self.priority,
            "criticality": self.criticality,
            "flow_id": self.flow_id,
            "source": self.source,
            "destination": self.destination,
            "hop_source": self.hop_source,
            "hop_destination": self.hop_destination,
            "c_value": self.c_value,
            "sequence_number": self.sequence_number,
            "data": self.data.hex(),
        }


class AirtightEntryType(Enum):
    """Airtight log entry types."""

    SEND = "SEND"
    ENQUEUE = "ENQUEUE"
    TRANSMIT = "TRANSMIT"
    RECEIVE = "RECEIVE"
    ACK_SUCCESS = "ACK_SUCCESS"
    ACK_FAIL = "ACK_FAIL"
    OBSERVATION = "OBSERVATION"
    DEQUEUE = "DEQUEUE"


class AirtightEntry(Entry):
    """Represents an event and associated details in an Airtight system."""

    def __init__(self, time: float, value: str):
        """Initialise Airtight entry."""
        super().__init__(time=time, value=value)

        event, *rest = self.value.split(" ")

        self.event = AirtightEntryType(event)

        self.slot_id = None
        self.node_id = None
        self.short_address = None
        self.packet_data = None
        self.raw_packet_data = None

        if self.event == AirtightEntryType.OBSERVATION:
            self.short_address, self.raw_packet_data = rest
        else:
            self.node_id, self.slot_id, self.raw_packet_data = rest

        if self.raw_packet_data is not None:
            self.packet_data = AirtightPacket.from_hex(self.raw_packet_data)

    def to_dict(self) -> EntryDictType:
        """Convert JSON compatible to dictionary."""
        return {
            **super().to_dict(), "event": self.event.value,
            "slot_id": self.slot_id,
            "node_id": self.node_id,
            "packet_data": self.packet_data.to_dict() if self.packet_data else {},
            "raw_packet_data": self.raw_packet_data,
            "id": self.get_id()
        }


_read_airtight_log_file = partial(read_log_file, entry_type=AirtightEntry)
_read_airtight_log_files = partial(read_log_files, entry_type=AirtightEntry)


class AirtightLog:
    """Represents a log of events in an Airtight system."""

    def __init__(self):
        """Initialise an empty log."""
        self._log: OrderedDict[float, List[AirtightEntry]] = OrderedDict()
        self._log_by_id: Dict[str, AirtightEntry] = dict()

    def add_entry(self, entry: AirtightEntry):
        """Add an entry to the log."""
        if entry.time not in self._log:
            self._log[entry.time] = list()
        self._log[entry.time].append(entry)

        entry_id = entry.get_id()
        if entry_id in self._log_by_id and entry not in self._log_by_id.values():
            raise Exception("ID was not unique")
        self._log_by_id[entry_id] = entry

    def to_dict(self) -> Dict[float, List[EntryDictType]]:
        """Get a JSON friendly representation of the log."""
        return {time: [entry.to_dict() for entry in entries] for time, entries in self._log.items()}

    def to_list(self) -> List[AirtightEntry]:
        """Get a JSON friendly representation of the log."""
        return [entry for _, entries in self._log.items() for entry in entries]

    @staticmethod
    def from_file(file: str) -> "AirtightLog":
        """Generate a new log from a log file."""
        new_log = AirtightLog()

        for entry in _read_airtight_log_file(file):
            new_log.add_entry(entry)

        return new_log

    @staticmethod
    def from_folder(folder: str) -> "AirtightLog":
        """Generate a new log from a log folder."""
        new_log = AirtightLog()

        for entry in _read_airtight_log_files(folder):
            new_log.add_entry(entry)

        return new_log


class SlotAction(Enum):
    """Represents possible Airtight slot actions."""

    IDLE = "IDLE"
    LISTEN = "LISTEN"
    TRANSMIT = "TRANSMIT"


class AirtightSlotTable:
    """Represents an Airtight slot table."""

    def __init__(self):
        """Initialise empty slot table."""
        self._nodes: Dict[int, List[SlotAction]] = dict()

    def add_node(self, node_id: int, node_actions: List[SlotAction]):
        """Add a node to the slot table."""
        self._nodes[node_id] = node_actions

    def to_dict(self) -> Dict[int, List[str]]:
        """Get a JSON friendly representation of the slot table."""
        return {node_id: [slot.value for slot in slots] for node_id, slots in self._nodes.items()}

    @staticmethod
    def from_file(file: str) -> "AirtightSlotTable":
        """Generate a new slot table from a file."""
        VALID_CHARACTERS = {'E', 'S', 'I', 'A', 'N', 'T', 'M', 'D', 'L', 'R'}

        file_data = ""
        with open(file, "r") as file_handle:
            for line in file_handle:
                file_data += line.strip()

        if not file_data.startswith("SLOT_TABLE"):
            raise Exception("Not slot table file")

        new_slot_table = AirtightSlotTable()

        bracket_depth = 0
        node_index = 0
        current_node_actions: List[SlotAction] = []
        action_so_far = ""

        for character in file_data:
            if character == "{":
                bracket_depth += 1
            elif character == "}":
                if bracket_depth == 3:
                    current_node_actions.append(SlotAction(action_so_far))
                    action_so_far = ""
                    new_slot_table.add_node(node_index, current_node_actions)
                    current_node_actions = []
                bracket_depth -= 1
            elif bracket_depth == 1 and character == ",":
                node_index += 1
            elif bracket_depth == 3 and character in VALID_CHARACTERS:
                action_so_far += character
            elif bracket_depth == 3 and character == ",":
                current_node_actions.append(SlotAction(action_so_far))
                action_so_far = ""
            elif character == ";":
                break

        return new_slot_table


def routes(app: Flask, data_path: str):
    """Initialise airtight routes."""
    if not path.isfile(path.join(data_path, "routes.txt")):
        raise Exception("routes.txt missing from data directory")
    if not path.isdir(data_path):
        raise Exception("Data directory missing")
    if not path.isfile(path.join(data_path, "slot_table.txt")):
        raise Exception("slot_table.txt missing from data directory")

    ROUTE_GRAPH = RouteGraph.from_file(path.join(data_path, "routes.txt"))
    EVENT_LOG = AirtightLog.from_folder(data_path)
    SLOT_TABLE = AirtightSlotTable.from_file(path.join(data_path, "slot_table.txt"))

    @app.route('/' + PROTOCOL_PATH + '/<path:path>')
    def send_airtight_static(path):
        """Send static airtight files."""
        return send_from_directory('static/airtight', path)

    @app.route('/' + PROTOCOL_PATH)
    def airtight():
        """Airtight UI."""
        return render_template('airtight.html')

    @app.route("/" + PROTOCOL_PATH + "/graph.json")
    def airtight_graph():
        """Airtight graph."""
        return jsonify(ROUTE_GRAPH.to_dict())

    @app.route("/" + PROTOCOL_PATH + "/slot_table.json")
    def airtight_slot_table():
        """Airtight slot table."""
        return jsonify(SLOT_TABLE.to_dict())

    @app.route("/" + PROTOCOL_PATH + "/info.json")
    def airtight_info():
        """Airtight slot table."""
        return jsonify({"slot_length": 100})

    @app.route("/" + PROTOCOL_PATH + "/log.json")
    def airtight_log():
        """Airtight log."""
        filter_range = request.args.get("range")
        filter_type = request.args.get("type")
        shape = request.args.get("shape")
        if shape == "linear":
            return jsonify(EVENT_LOG.to_list())
        else:
            return jsonify(EVENT_LOG.to_dict())
