/*jshint esversion: 6 */

const RULES = [
    (context, entry) => { /* Validate enqueues */
        if (entry.event != "ENQUEUE")
            return;

        let rangeStart = entry.time - context.app.info.slot_length;
        if (rangeStart < 0) rangeStart = 0;

        let matches = context.app.findInRangeWithNodeId(rangeStart, entry.time + 1, "SEND", entry.node_id);
        matches = matches.concat(context.app.findInRangeWithNodeId(rangeStart, entry.time + 1, "RECEIVE", entry.node_id));

        let sourceCount = 0;

        for (let match of matches) {
            if (
                match.slot_id == entry.slot_id &&
                match.priority == entry.priority &&
                match.criticality == entry.criticality &&
                match.flow_id == entry.flow_id &&
                match.source == entry.source &&
                match.destination == entry.destination &&
                match.data == entry.data
            ) {
                sourceCount += 1;
            }
        }

        if (sourceCount < 1) {
            context.app.addErrorToEntry(entry, "No recorded events could have triggered this enqueue.", ERROR, "event-rules");
        }
    },
    (context, entry) => { /* Validate receive locations */
        if (entry.event != "RECEIVE")
            return;

        let rangeStart = entry.time - context.app.info.slot_length;
        if (rangeStart < 0) rangeStart = 0;

        let matches = context.app.findInRange(rangeStart, entry.time + 10, "TRANSMIT");

        let sourceCount = 0;

        for (let match of matches) {
            if (
                match.priority == entry.priority &&
                match.criticality == entry.criticality &&
                match.flow_id == entry.flow_id &&
                match.source == entry.source &&
                match.destination == entry.destination &&
                match.sequence_number == entry.sequence_number &&
                match.data == entry.data
            ) {
                sourceCount += 1;
            }
        }

        if (sourceCount < 1) {

            matches = context.app.findInRange(rangeStart, entry.time + (context.app.info.slot_length / 2), "TRANSMIT");

            for (let match of matches) {
                if (
                    match.priority == entry.priority &&
                    match.criticality == entry.criticality &&
                    match.flow_id == entry.flow_id &&
                    match.source == entry.source &&
                    match.destination == entry.destination &&
                    match.sequence_number == entry.sequence_number &&
                    match.data == entry.data
                ) {
                    sourceCount += 1;
                }
            }

            if (sourceCount < 1) {
                context.app.addErrorToEntry(entry, "No recorded events could have transmitted this data.", ERROR, "event-rules");
            } else {
                context.app.addErrorToEntry(entry, "Transmit event was recorded ahead of receive, synchronisation issue?.", WARNING, "event-rules");
            }
        }
    },
    (context, entry) => { /* Find dequeues due to failed acknowledges. */
        if (entry.event != "DEQUEUE")
            return;

        let rangeStart = entry.time - 10;
        if (rangeStart < 0) rangeStart = 0;

        let matches = context.app.findInRange(rangeStart, entry.time + 10, "ACK_FAIL");

        let failCount = 0;

        for (let match of matches) {
            if (
                match.priority == entry.priority &&
                match.criticality == entry.criticality &&
                match.flow_id == entry.flow_id &&
                match.source == entry.source &&
                match.destination == entry.destination &&
                match.sequence_number == entry.sequence_number &&
                match.data == entry.data
            ) {
                failCount += 1;
            }
        }

        if (failCount > 0) {
            context.app.addErrorToEntry(entry, "Packet was dequeued due to failed acknowledgement limit.", WARNING, "event-rules");
        }
    }
];
