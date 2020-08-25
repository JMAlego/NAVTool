/*jshint esversion: 6 */
/**
 * Protocol logic.
 */

const INFO = 0;
const WARNING = 1;
const ERROR = 2;

const TIMELINE_ENTRY_WIDTH_PX = 50;
const EVENT_TYPE_BACKGROUND_COLOURS = {
    "SEND": "#444",
    "ENQUEUE": "#444",
    "DEQUEUE": "#444",
    "TRANSMIT": "#4287f5",
    "RECEIVE": "#42f569",
    "ACK_SUCCESS": "#8af542",
    "ACK_FAIL": "#f59642",
    "OBSERVATION": "#9c9c9c",
};
const EVENT_TYPE_TEXT_COLOURS = {
    "SEND": "#fff",
    "ENQUEUE": "#fff",
    "DEQUEUE": "#fff",
    "TRANSMIT": "#000",
    "RECEIVE": "#000",
    "ACK_SUCCESS": "#000",
    "ACK_FAIL": "#000",
    "OBSERVATION": "#000",
};
const EVENT_TYPES = [
    "SEND",
    "ENQUEUE",
    "DEQUEUE",
    "TRANSMIT",
    "RECEIVE",
    "ACK_SUCCESS",
    "ACK_FAIL",
    "OBSERVATION",
];
const EVENT_TO_SLOT_ACTION = {
    "SEND": null,
    "ENQUEUE": null,
    "DEQUEUE": null,
    "TRANSMIT": "TRANSMIT",
    "RECEIVE": "LISTEN",
    "ACK_SUCCESS": "TRANSMIT",
    "ACK_FAIL": "TRANSMIT",
    "OBSERVATION": null,
};
const WIDTH_PER_TIME_UNIT = 25;

/**
 * Protocol application.
 */
class App {
    /**
     * Construct the protocol app.
     *
     * @param {AppFramework} context
     */
    constructor(context) {
        this.context = context;
        this.graph = context.data.graph;
        this.log = context.data.log;
        this.info = context.data.info;
        this.logById = {};
        this.sortedLogKeys = null;
        this.slotTable = context.data.slot_table;
        this.cytoscape = null;
    }

    /**
     * Initialise the protocol.
     */
    init() {
        console.log("Init app");
        this.initGraph();
        this.initLog();
        this.initTimeline();
    }

    /**
     * Initialise graph.
     */
    initGraph() {
        console.log("Init graph");
        this.cytoscape = cytoscape({
            container: document.getElementById('graph'),
            layout: {
                name: 'avsdf',
                nodeSeparation: 120
            },
            style: [
                {
                    selector: "edge",
                    style: {
                        "curve-style": "bezier",
                    }
                },
                {
                    selector: "edge",
                    style: {
                        "target-arrow-shape": "triangle"
                    }
                },
                {
                    selector: 'node',
                    style: {
                        'label': 'data(id)',
                        'text-valign': 'center',
                        'color': '#000000',
                    }
                },
                {
                    selector: 'node.selected-source',
                    style: {
                        'border-color': '#990000',
                        'border-width': '2px',
                        'border-style': 'dashed',
                    }
                },
                {
                    selector: 'node.selected-target',
                    style: {
                        'border-color': '#000099',
                        'border-width': '2px',
                        'border-style': 'dashed',
                    }
                },
                {
                    selector: 'edge.selected',
                    style: {
                        "line-color": "#009900",
                        "target-arrow-color": "#009900"
                    }
                }
            ]
        });
        let data = this.graph;
        this.cytoscape.add(data.nodes);
        this.cytoscape.add(data.edges);
        this.cytoscape.layout({
            name: 'cola',
            nodeSeparation: 120
        }).run();
        this.cytoscape.nodes().on('click', e => {
            let clickedNode = e.target;
            console.log(clickedNode);
            this.clearSelection();
            let infoTableData = [["Slot Index", "Slot Action"]];
            let slotIndex = 0;
            const node_id = clickedNode.id().substr(1);
            for (let slot of this.slotTable[node_id]) {
                infoTableData.push([slotIndex, slot]);
                slotIndex++;
            }
            this.updateInfoPane(infoTableData);
            $("#info").append(
                $(document.createElement("button"))
                    .text("✓ Verify Transmit Spacing")
                    .on("click", _ => this.verifyTransmitSpacing(node_id))
            );
        });
    }

    /**
     * Initialise log.
     */
    initLog() {
        console.log("Init log");
        // We need to make sure that we iterate over the data in timeline order
        this.sortedLogKeys = Object.keys(this.log).sort((a, b) => parseFloat(a) - parseFloat(b));
        for (let key of this.sortedLogKeys) {
            for (let entry of this.log[key]) {
                $("#log").append(
                    $(document.createElement('tr'))
                        .attr("id", entry.id)
                        .click(entry.id, e => this.logEntryClickHandler(e))
                        .dblclick(entry.id, e => this.logEntryDoubleClickHandler(e))
                        .append($(document.createElement('td')).addClass("error-container"))
                        .append($(document.createElement('td')).text(entry.time))
                        .append($(document.createElement('td')).text(entry.event))
                        .append($(document.createElement('td')).text(entry.node_id))
                        .append($(document.createElement('td')).text(entry.slot_id))
                        .append($(document.createElement('td')).text(entry.raw_packet_data))
                );
                this.logById[entry.id] = entry;
            }
        }
    }

    /**
     * Initialise the timeline.
     */
    initTimeline() {
        console.log("Init timeline");

        const minTime = this.sortedLogKeys[0];
        const maxTime = this.sortedLogKeys[this.sortedLogKeys.length - 1];

        /*
            This calculation needs rework to actually be used. Could lead to _very_ wide timelines.

            let minDiff = -1;
            for (let index = 0; index < this.sortedLogKeys.length - 1; index++) {
                const elementA = this.sortedLogKeys[index];
                const elementB = this.sortedLogKeys[index + 1];
                const diff = elementB - elementA;
                if (diff < minDiff || minDiff == -1)
                    minDiff = diff;
            }
            const widthPerTimeUnit = Math.ceil(TIMELINE_ENTRY_WIDTH_PX / minDiff);
        */

        let timelines = {};

        for (let node of Object.keys(this.slotTable)) {
            let timelineNodeDiv = $(document.createElement('div'))
                .addClass("timeline-node-row")
                .append(
                    $(document.createElement('div'))
                        .addClass("timeline-node-heading")
                        .append(
                            $(document.createElement('div'))
                                .addClass("timeline-node-expander")
                                .text("▼")
                                .on("click", e => {
                                    let target = $(e.currentTarget);
                                    if (target.hasClass("contracted")) {
                                        $(e.currentTarget.parentNode.parentNode)
                                            .children(".timeline-event-type")
                                            .removeClass("contract");
                                        target.removeClass("contracted");
                                    }
                                    else {
                                        $(e.currentTarget.parentNode.parentNode)
                                            .children(".timeline-event-type")
                                            .addClass("contract");
                                        target.addClass("contracted");
                                    }
                                })
                        )
                        .append(
                            $(document.createElement('div')).text(`Node ${node} Events`)
                        )
                )
                .append(
                    $(document.createElement('div'))
                        .addClass("timeline-node-heading-spacer")
                );

            timelines[node] = {};

            for (let event_type of EVENT_TYPES) {
                timelines[node][event_type] = $(document.createElement('div'));
            }

            for (let eventTypeName of Object.keys(timelines[node])) {
                const eventType = timelines[node][eventTypeName];
                timelineNodeDiv.append(eventType.addClass("timeline-event-type").append(
                    $(document.createElement('div')).addClass("timeline-event-type-heading")
                        .text(eventTypeName)
                ).append(
                    $(document.createElement('div')).addClass("timeline-event-type-content")
                ));
            }

            $("#timeline").append(timelineNodeDiv);
        }

        const minimap = $(".timeline-minimap");

        for (let key of this.sortedLogKeys) {
            for (let entry of this.log[key]) {
                let eventDiv = $(document.createElement('div'))
                    .attr("id", entry.id + "-tl")
                    .data("time", entry.time)
                    .css("left", `${(Math.ceil((entry.time - minTime) * WIDTH_PER_TIME_UNIT))}px`)
                    .css("width", `${TIMELINE_ENTRY_WIDTH_PX}px`)
                    .css("background", `${EVENT_TYPE_BACKGROUND_COLOURS[entry.event]}`)
                    .css("color", `${EVENT_TYPE_TEXT_COLOURS[entry.event]}`)
                    .text(entry.time)
                    .click(entry.id, e => this.timelineEntryClickHandler(e))
                    .addClass("timeline-entry");
                timelines[entry.node_id][entry.event].children(".timeline-event-type-content").append(eventDiv);

                minimap.append(
                    $(document.createElement('div'))
                        .css("left", `${(entry.time - minTime) / (maxTime - minTime) * 100}%`)
                        .css("background", `${EVENT_TYPE_BACKGROUND_COLOURS[entry.event]}`)
                        .addClass("timeline-minimap-marker")
                        .attr("id", `${entry.id}-mm`)
                );
            }
        }

        $("#timeline").on("scroll", this.handleTimelineScroll);
        this.handleTimelineScroll();

    }

    /**
     * Handle the timeline scroll to update the minimap.
     */
    handleTimelineScroll() {
        const timeline = document.getElementById("timeline");
        const timelineViewBox = document.getElementById("timeline-minimap-view-box");
        const timelineWidthFull = timeline.scrollWidth;
        const timelineWidthVisible = timeline.clientWidth;
        const leftScroll = timeline.scrollLeft;
        const rightScroll = leftScroll + timelineWidthVisible;

        timelineViewBox.style.left = `${(leftScroll / timelineWidthFull * 100)}%`;
        timelineViewBox.style.width = `${(rightScroll / timelineWidthFull * 100) - (leftScroll / timelineWidthFull * 100)}%`;

        $(".timeline-node-heading").css("left", leftScroll);
    }

    /**
     * Get all log entries.
     */
    entries() {
        return Object.values(this.logById);
    }

    /**
     * Get the event ID of the selected UI event.
     */
    getSelected() {
        // Nullish coalescing operator syntax highlighting is broken, so use the long form instead.
        const id = $(".selected").next().attr("id");
        return id ? id.split("-")[0] : null;
    }

    /**
     * Clear the info pane.
     */
    clearInfoPane() {
        $("#info").html("<!-- Nothing. -->");
    }

    /**
     * Set the info pain to be a specific element.
     *
     * @param {Element} element
     */
    setInfoPane(element) {
        this.clearInfoPane();
        $("#info").append(element);
    }

    /**
     * Update the info pain with specific information.
     *
     * @param {[[String, String]]} rows
     */
    updateInfoPane(rows) {
        this.clearInfoPane();
        let infoTable = $(document.createElement('table'));
        for (let row of rows) {
            let first = true;
            let rowElement = $(document.createElement('tr'));
            for (let column of row) {
                rowElement.append((first ? $(document.createElement('th')) : $(document.createElement('td')))
                    .text(column));
                first = false;
            }
            infoTable.append(rowElement);
        }
        this.setInfoPane(infoTable);
    }

    /**
     * Update the info pane to show information about the specified ID.
     *
     * @param {String} log_id
     */
    updateInfoPaneByLogId(log_id) {
        const elementEntry = this.logById[log_id];
        this.updateInfoPane([
            ["Time", elementEntry.time],
            ["Event", elementEntry.event],
            ["Node ID", elementEntry.node_id],
            ["Slot Index", this.slotTable[elementEntry.node_id][elementEntry.slot_id] + " (" + elementEntry.slot_id + ")"],
            ["Raw Packet Data", elementEntry.raw_packet_data],
            ["Event ID (Internal)", elementEntry.id],
            ["Packet Data:"],
            ["Priority", elementEntry.packet_data.priority],
            ["Criticality", elementEntry.packet_data.criticality],
            ["Flow ID", elementEntry.packet_data.flow_id],
            ["Source", elementEntry.packet_data.source],
            ["Destination", elementEntry.packet_data.destination],
            ["Hop Source", elementEntry.packet_data.hop_source],
            ["Hop Destination", elementEntry.packet_data.hop_destination],
            ["C Value", elementEntry.packet_data.c_value],
            ["Sequence Number", elementEntry.packet_data.sequence_number],
            ["Data", elementEntry.packet_data.data],
        ]);
    }

    /**
     * Clear the selection of an event across all UI elements.
     */
    clearSelection() {
        this.clearInfoPane();
        $(".selected").removeClass("selected");
        this.cytoscape.nodes().removeClass("selected-source");
        this.cytoscape.nodes().removeClass("selected-target");
        this.cytoscape.edges().removeClass("selected");
    }

    /**
     * Set the selected event across all UI elements in which it appears.
     *
     * @param {String} selected_id
     */
    setSelected(selected_id) {
        this.updateInfoPaneByLogId(selected_id);
        $(".selected").removeClass("selected");
        this.cytoscape.nodes().removeClass("selected-source");
        this.cytoscape.nodes().removeClass("selected-target");
        this.cytoscape.edges().removeClass("selected");
        $(`#${selected_id}`).addClass("selected");
        $(`#${selected_id}-tl`).addClass("selected");
        $(`#${selected_id}-mm`).addClass("selected");
        const entry = this.logById[selected_id];
        console.log(entry.packet_data.hop_source, entry.packet_data.hop_destination);
        this.cytoscape.getElementById(`n${entry.packet_data.hop_source}`).addClass("selected-source");
        this.cytoscape.getElementById(`n${entry.packet_data.hop_source}`)
            .edgesTo(`#n${entry.packet_data.hop_destination}`)[0]
            .addClass("selected");
        this.cytoscape.getElementById(`n${entry.packet_data.hop_destination}`).addClass("selected-target");
    }

    /**
     * Handle single click on log entry.
     *
     * @param {Event} event
     */
    logEntryClickHandler(event) {
        this.setSelected(event.currentTarget.id);
    }

    /**
     * Handle double click on log entry.
     *
     * @param {Event} event
     */
    logEntryDoubleClickHandler(event) {
        this.showErrorLogForEvent(event.currentTarget.id);
    }

    /**
     * Show the error log for an event.
     *
     * @param {String} id
     */
    showErrorLogForEvent(id) {
        $("#event-error-log").html("<div id=\"close\" onclick=\"$('#event-error-log').hide()\">X</div>");
        for (let element of $(document.getElementById(id)).find(".error-container span")) {
            $("#event-error-log").append($(document.createElement("div")).addClass("error-row").text($(element).attr("title")));
        }
        $("#event-error-log").show();
    }

    /**
     * Handler for clicking on items in the timeline.
     *
     * @param {Event} event
     */
    timelineEntryClickHandler(event) {
        this.setSelected(event.currentTarget.id.substr(0, event.currentTarget.id.length - 3));
    }

    /**
     * Find events in a time range with a specific entry type.
     *
     * @param {Number} timeStart
     * @param {Number} timeEnd
     * @param {String} entryType
     */
    findInRange(timeStart, timeEnd, entryType) {
        let matches = [];
        for (let key of this.sortedLogKeys.filter(x => timeStart <= x && x <= timeEnd)) {
            for (let entry of this.log[key]) {
                if (entry.event == entryType) {
                    matches.push(entry);
                }
            }
        }
        return matches;
    }

    /**
     *  Find events in a time range with a specific entry type and node id.
     *
     * @param {Number} timeStart
     * @param {Number} timeEnd
     * @param {String} entryType
     * @param {String} nodeId
     */
    findInRangeWithNodeId(timeStart, timeEnd, entryType, nodeId) {
        let matches = [];
        for (let entry of this.findInRange(timeStart, timeEnd, entryType)) {
            if (entry.node_id == nodeId) {
                matches.push(entry);
            }
        }
        return matches;
    }

    /**
     * Verify the transmit spacing of transmit events.
     *
     * @param {String} node_id
     */
    verifyTransmitSpacing(node_id) {
        let lastTransmit = -1;
        let intervals = [];
        for (let key of this.sortedLogKeys) {
            for (let entry of this.log[key]) {
                if (entry.node_id != node_id || entry.event != "TRANSMIT") continue;
                if (lastTransmit != -1) {
                    intervals.push(entry.time - lastTransmit);
                }
                lastTransmit = entry.time;
            }
        }
        if (intervals.length == 0) {
            alert("One or less transmits found. There must be at least two to check spacing.");
        }
        else {
            const averageInterval = intervals.reduce((a, c) => a + c) / intervals.length;
            alert(`Average interval between transmissions is ${averageInterval}.`);
        }
    }

    /**
     * Verify slot associations.
     */
    verifySlots() {
        for (let key of this.sortedLogKeys) {
            for (let entry of this.log[key]) {
                const slotAction = this.slotTable[entry.node_id][entry.slot_id];
                const expectedSlotAction = EVENT_TO_SLOT_ACTION[entry.event];
                if (expectedSlotAction == null) continue;

                if (expectedSlotAction != slotAction) {
                    if (confirm(`Slot error found, event ${entry.event} occurred during slot ${entry.slot_id} of node ${entry.node_id} which is a ${slotAction} slot.\n\n Do you want to highlight the error event?`)) {
                        this.setSelected(entry.id);
                        return;
                    }
                }
            }
        }
    }

    /**
     * Add an error to a log entry.
     *
     * @param {Element} entry
     * @param {String} errorText
     * @param {Number} errorLevel
     * @param {String} errorSource
     */
    addErrorToEntry(entry, errorText, errorLevel, errorSource) {
        const errorLevelToClass = ["info", "warning", "error"];
        $(document.getElementById(entry.id)).find(".error-container")
            .append(
                $(document.createElement("span"))
                    .attr("data-error-source", errorSource)
                    .text("❗")
                    .attr("title", errorLevelToClass[errorLevel][0].toUpperCase() + errorLevelToClass[errorLevel].substr(1) + ": " + errorText)
                    .addClass(errorLevelToClass[errorLevel])
            );
    }
}
