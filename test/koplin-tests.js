const _ = require("lodash");
const d3 = require("d3-hierarchy");
require("../supergroup");
const Papa = require("papaparse");
const path = require("path");
const fs = require("fs");

let csv = fs.readFileSync(path.join(__dirname, "issue_data.csv"), "utf8");
let { data } = Papa.parse(csv, { header: true });
let s = _.stratify(data, [
    {
        dim: "parent_urn",
        opts: { dimName: "parent_issue" }
    },
    { dim: "urn", opts: { dimName: "issue" } }
]);
s.select2Data();
// s.eachBefore(console.log);
// s;
// console.log(JSON.stringify(s.d3NestEntries(), null, "\t"));
