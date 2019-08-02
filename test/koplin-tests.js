const _ = require("lodash");
const d3 = require("d3-hierarchy");
require("../supergroup");
const Papa = require("papaparse");
const path = require("path");
const fs = require("fs");

let csv = fs.readFileSync(path.join(__dirname, "tree_test_data.csv"), "utf8");
let { data } = Papa.parse(csv, { header: true });
let s = _.hierarchicalTableToTree(data, ["p", { dim: "c" }]);
// console.log(s.d3NestMap(), null, "\t");
