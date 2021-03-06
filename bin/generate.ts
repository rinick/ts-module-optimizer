import Fs = require('fs');
import Path = require('path');


let moduleReg = /(^|\n)module ([a-zA-Z]\w+) /;

let reg0 = /extends ([A-Z]\w+)/g;
let reg1 = /(\/\/\/requires|implements) (([A-Z]\w+[, ]*)+)/g;
let reg2 = /\n    [^ \n][^\n]* = (new )?([A-Z]\w+)/g;
let reg4 = /\n        static [^\n]*: ([A-Z]\w+)[^\n()]*$/g;

let reg_t = /export( abstract)? (class|interface|type) ([A-Z]\w+)/g;

function analyzeFile(folder:string, foldername:string, file:string, dict:Object, classes:Set<string>, modules:Set<string>) {
    let name = file.substr(0, file.length - 3);
    let data = Fs.readFileSync(folder + '/' + file, 'utf8');

    let moduleMatch = data.match(moduleReg);
    if (!moduleMatch) {
        return;
    }
    modules.add(moduleMatch[2]);


    let deps = new Set();
    let myclass = new Set();
    data.replace(reg0, function (m, m1):string {
        // find extends
        deps.add(m1);
        return '';
    });
    data.replace(reg1, function (m, m1, m2):string {
        // find implements
        for (let dep of m2.split(','))
            deps.add(dep.trim());
        return '';
    });
    data.replace(reg2, function (m, m1, m2):string {
        // find assignment
        deps.add(m2);
        return '';
    });

    data.replace(reg4, function (m, m1) {
        // find return type and defined type
        deps.add(m1);
        return '';
    });
    data.replace(reg_t, function (m, m1, m2, m3) {
        // find export class
        classes.add(m3);
        myclass.add(m3);
        return '';
    });
    for (let c of myclass) {
        deps.delete(c);
    }

    dict[name] = {
        'file': file,
        'ref': foldername + file,
        'deps': Array.from(deps),
        'classes': Array.from(myclass)
    };
}

let dict:Object= {};
let classes:Set<string> = new Set();
let modules:Set<string> = new Set();
let outputs:string[] = [];

function analyzeFolder(folder:string, foldername:string) {
    console.log(`analyzing ${folder}`);
    for (let str of Fs.readdirSync(folder)) {
        if (str.endsWith('.ts') && !str.endsWith('.d.ts')) {
            analyzeFile(folder, foldername, str, dict, classes, modules);
        } else if (!str.includes('.')) {
            analyzeFolder(folder + '/' + str, foldername + str + '/');
        }
    }
}

function resolve() {
    // find the correct order of modules
    while (true) {
        let found = false;
        let keys = Object.getOwnPropertyNames(dict);
        if (keys.length == 0) break;
        for (let key of keys) {
            let obj = dict[key];
            obj.deps = obj.deps.filter((str)=>classes.has(str));
        }
        for (let key of keys) {
            let obj = dict[key];
            if (obj.deps.length == 0) {
                outputs.push('\/\/\/ <reference path="' + obj.ref + '" />');
                for (let c of obj.classes) {
                    classes.delete(c);
                }
                delete dict[key];
                found = true;
            }
        }
        if (!found) {
            throw 'circular dependency';
        }
    }
}


export function generate_index(path:string):string {
    dict = {};
    classes = new Set();
    modules = new Set();
    outputs = [];

    analyzeFolder(path, '');

    if (modules.size == 1) {
        let moduleName = modules.values().next().value;
        resolve();

        Fs.writeFileSync(Path.resolve(path, `${moduleName}.ts`), outputs.join('\n'));
        return moduleName;
    } else {
        throw 'multiple modules found: ' + modules.values();
    }
}



