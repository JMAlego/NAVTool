/*jshint esversion: 6 */

/* PROTOCOL is defined elsewhere */

/**
 * Simple load script function.
 *
 * @param {String} scriptPath
 * @param {Function} callback
 */
function loadScript(scriptPath, callback) {
    var script = document.createElement('script');
    script.onload = callback;
    script.src = scriptPath;
    document.head.appendChild(script);
}

/**
 * Protocol application loader framework.
 */
class AppFramework {
    constructor() {
        this.protocol = PROTOCOL;
        this.data = {};
    }

    /**
     * Initialise the framework.
     */
    init() {
        let parent = this;
        $.getJSON("/" + this.protocol + "/protocol.json", function (data) {
            parent.configuration = data;
            parent.protocolInit();
        });
    }

    /**
     * Initialise the selected protocol.
     */
    protocolInit() {
        let dataFileStatus = {};
        let parent = this;

        for (const dataFileName of Object.keys(this.configuration.data)) {
            dataFileStatus[dataFileName] = false;
            const dataFilePath = this.configuration.data[dataFileName];
            $.getJSON("/" + this.protocol + "/" + dataFilePath, function (data) {
                parent.data[dataFileName] = data;
                dataFileStatus[dataFileName] = true;
                let allTrue = true;
                for (const status of Object.values(dataFileStatus)) {
                    if (!status) allTrue = false;
                }
                if (allTrue) {
                    loadScript("/" + parent.protocol + "/" + parent.configuration.rules, () => {
                        loadScript("/" + parent.protocol + "/" + parent.configuration.logic, () => {
                            parent.app = new App(parent);
                            parent.app.init();
                        });
                    });
                }
            });
        }
    }

    /**
     * Verify generic rule sets.
     */
    verifyRules()
    {
        for (let rule of RULES) {
            for (let entry of this.app.entries()) {
                rule(this, entry);
            }
        }
    }
}
