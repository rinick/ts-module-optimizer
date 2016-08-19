"use strict";

const Fs = require('fs');
const Path = require('path');

export function optimize_module(path, moduleName) {
    // merge modules to single scope
    let search = new RegExp(`\\}\\)\\(${moduleName} \\|\\| \\(${moduleName} = \\{\\}\\)\\);\\r?\\nvar ${moduleName};\\r?\\n\\(function \\(${moduleName}\\) \\{`,'g');

    let rows = Fs.readFileSync(path, 'utf8').replace(search, '\n\n').split('\n');

    let breezeReg = new RegExp(`\\b${moduleName}\\.`,'g');
    let exportReg = new RegExp(`\\b${moduleName}\\.(\\w+) = (\\w+);`);
    for (let i in rows) {
        let row = rows[i];
        if (row.includes(moduleName)) {
            let m = row.match(exportReg);
            if (m && m[1] === m[2]) continue;
            rows[i] = row.replace(breezeReg, '');
        }
    }
    rows.push(`module.exports = ${moduleName};\n`);

    Fs.writeFileSync(path, rows.join('\n'));
}