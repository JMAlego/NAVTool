/*jshint esversion: 6 */

const INFO = 0;
const WARNING = 1;
const ERROR = 2;

class App {
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

    init() {
        console.log("Init app");
        this.initGraph();
        this.initLog();
        this.initTimeline();
    }

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

    initTimeline() {
        console.log("Init timeline");

        const TIMELINE_ENTRY_WIDTH_PX = 50;
        const EVENT_TYPE_BACKGROUND_COLOURS = {
            "SEND": "#444",
            "ENQUEUE": "#444",
            "TRANSMIT": "#4287f5",
            "RECEIVE": "#42f569",
            "ACK_SUCCESS": "#8af542",
            "ACK_FAIL": "#f59642",
            "OBSERVATION": "#9c9c9c",
        };
        const EVENT_TYPE_TEXT_COLOURS = {
            "SEND": "#fff",
            "ENQUEUE": "#fff",
            "TRANSMIT": "#000",
            "RECEIVE": "#000",
            "ACK_SUCCESS": "#000",
            "ACK_FAIL": "#000",
            "OBSERVATION": "#000",
        };
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
        const WIDTH_PER_TIME_UNIT = 100;

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

            timelines[node] = {
                "SEND": $(document.createElement('div')),
                "ENQUEUE": $(document.createElement('div')),
                "TRANSMIT": $(document.createElement('div')),
                "RECEIVE": $(document.createElement('div')),
                "ACK_SUCCESS": $(document.createElement('div')),
                "ACK_FAIL": $(document.createElement('div')),
                "OBSERVATION": $(document.createElement('div')),
            };

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

    entries()
    {
        return Object.values(this.logById);
    }

    getSelected() {
        // Nullish coalescing operator syntax highlighting is broken, so use the long form instead.
        const id = $(".selected").next().attr("id");
        return id ? id.split("-")[0] : null;
    }

    clearInfoPane() {
        $("#info").html("<!-- Nothing. -->");
    }

    setInfoPane(element) {
        this.clearInfoPane();
        $("#info").append(element);
    }

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

    clearSelection() {
        this.clearInfoPane();
        $(".selected").removeClass("selected");
        this.cytoscape.nodes().removeClass("selected-source");
        this.cytoscape.nodes().removeClass("selected-target");
        this.cytoscape.edges().removeClass("selected");
    }

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

    logEntryClickHandler(event) {
        this.setSelected(event.currentTarget.id);
    }

    logEntryDoubleClickHandler(event) {
        this.showErrorLogForEvent(event.currentTarget.id);
    }

    showErrorLogForEvent(id) {
        $("#event-error-log").html("<div id=\"close\" onclick=\"$('#event-error-log').hide()\">X</div>");
        for (let element of $(document.getElementById(id)).find(".error-container span")) {
            $("#event-error-log").append($(document.createElement("div")).addClass("error-row").text($(element).attr("title")));
        }
        $("#event-error-log").show();
    }

    timelineEntryClickHandler(event) {
        this.setSelected(event.currentTarget.id.substr(0, event.currentTarget.id.length - 3));
    }

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

    findInRangeWithNodeId(timeStart, timeEnd, entryType, nodeId) {
        let matches = [];
        for (let entry of this.findInRange(timeStart, timeEnd, entryType)) {
            if (entry.node_id == nodeId) {
                matches.push(entry);
            }
        }
        return matches;
    }

    verifyHop() {
        const parent = this;
        const MAX_DRIFT = 100;
        function findHopStart() {
            const entry = parent.logById[selected];
            if (entry.event == "RECEIVE" || entry.event == "OBSERVATION") {

            }
        }
        let selected = this.getSelected();
        if (!selected) return;
    }

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

    verifySlots() {
        const EVENT_TO_SLOT_ACTION = {
            "SEND": null,
            "ENQUEUE": null,
            "TRANSMIT": "TRANSMIT",
            "RECEIVE": "LISTEN",
            "ACK_SUCCESS": "TRANSMIT",
            "ACK_FAIL": "TRANSMIT",
            "OBSERVATION": null,
        }
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
