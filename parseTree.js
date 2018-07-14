class MagicTreePath{
    constructor(source, parentNode, childNode) {
        this.source = source;
        this.from = parentNode;
        this.to = childNode;
        const parts = this.source.split(':');
        this.startRow = parts[0];
        this.startCol = parts[1];
        this.path = parts[2];

        // pad out to cover the parent node text
        const parentWidth = this.from.source.length;
        this.path = "-r".repeat(parentWidth) + this.path;
        this.startCol -= parentWidth;
    }

    getMinWidth() {
        return (this.path.substr(this.path.search(/r\+/)).match(/r/g) || '').length;
    }

    getFullWidth() {
        return (this.path.match(/r/g) || '').length;
    }

    getColorClass() {
        if(this.from.learned && this.to.learned) return 't';
        if(this.from.learned) return 'n';
        return 'd';
    }

    getVisibleToPlayer() {
        return this.from.getVisibleToPlayer() && this.to.getVisibleToPlayer();
    }
}


class MagicTree{
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.tiers = [];
        this.nodes = [];
        this.nodeMap = {};
        this.paths = [];
    }

    addNode(n) {
        this.nodes.push(n);
        this.nodeMap[n.name] = n;
        this.paths.push(...n.children.map(c => c.path));
    }

    maxColor(...args) {
        const colorMap = {
            t: 0,
            b: 1,
            n: 2,
            r: 3,
            c: 4,
            d: 5,
        };
        args.sort((a, b) => colorMap[a] - colorMap[b]);
        return args[0];
    }

    toString(formatted = false, forceShowAll = false) {
        const printSource = [];
        for(let i=0; i<this.rows; i++) {
            printSource[i] = [];
            for(let j=0; j<this.cols; j++) {
                printSource[i].push([' ', 'd', false]); // [symbol, color, dontPurge]
            }
        }

        this.paths.forEach(p => {
            if(!p.getVisibleToPlayer() && !forceShowAll) return;
            let row = p.startRow;
            let col = p.startCol;
            let path = p.path;
            const colorClass = p.getColorClass();
            let i = 0;
            while(i < path.length) {
                printSource[row][col][0] = path[i++];
                printSource[row][col][1] = this.maxColor(colorClass, printSource[row][col][1]);
                switch(path[i++]) {
                    case 'r': col++; break;
                    case 'u': row--; break;
                    case 'd': row++; break;
                }
            }
        });

        this.nodes.forEach(n => {
            if(!n.getVisibleToPlayer() && !forceShowAll) return;
            let realText = n.toString();
            for(let i=0; i<n.source.length; i++) {
                const color = n.getColorClass();
                if(i < realText.length) {
                    printSource[n.row][n.col+i] = [realText[i], color, n.name];
                }
            }
        });

        // purge lines with no things
        const lineContainsData = printSource.map(l => l.some(c => c[0] != '|' && c[0] != ' '));
        for(let i = printSource.length-1; i >= 0; i--) {
            if(!lineContainsData[i] && !lineContainsData[i-1]) {
                printSource.splice(i, 1);
            }
        }

        // purge columns with no things
        const colContainsData = [];
        for(let i = this.cols; i >= 0; i--) {
            colContainsData[i] = printSource.some(line => {
                if(line[i] && line[i][2] !== false) return true;
                return line[i] && line[i][0] != ' ' && line[i][0] != '-';
            });
        }
        for(let i = this.cols; i >= 0; i--) {
            if(!colContainsData[i] && !colContainsData[i-1] && !colContainsData[i-2] && !colContainsData[i-3]) {
                // splice col from all lines
                printSource.forEach(line => line.splice(i, 1));
            }
        }

        // finalize
        if(!formatted) {
            return printSource.map(l => l.map(([s, c]) => s).join('')).join('\n');
        }

        // condense lines with format markers
        let lastLinkState = false;
        const lines = printSource.map(line => {
            let lastColorClass = "r";
            let result = "";
            line.forEach(([symbol, colorClass, linkState]) => {
                if(linkState !== lastLinkState) {
                    if(linkState === false) {
                        result += "%e";
                    }else{
                        result += `%l{${linkState}}`;
                    }
                    lastLinkState = linkState;
                }
                if(symbol != ' ' && colorClass != lastColorClass) {
                    lastColorClass = colorClass;
                    result += "%" + colorClass;
                }
                result += symbol;
            });
            return result;
        });
        return lines.join('\n');
    }
}

class MagicTreeNode{
    constructor(treeSource, row, col) {
        this.row = row;
        this.col = col;
        this.children = []; // [{path, node}]
        this.parents = []; // [{path, node}]
        this.rightIndex = treeSource[row].indexOf(']', col) + 1;
        this.source = treeSource[row].substring(col, this.rightIndex);
        this.learned = false;
        this.parse();
    }

    getHash() {
        return this.row + ' ' + this.col;
    }

    parse() {
        let match = this.source.match(/\[([0-9]+) ([0-9]+) ([0-9]+) ([0-9]+) +([a-zA-Z0-9* _\-.]+)\]/);
        if(!match) {
            this.name = this.source;
            return;
        }
        this.str = match[1];
        this.pre = match[2];
        this.sol = match[3];
        this.voi = match[4];
        this.name = match[5];
    }

    toString() {
        return '[' + this.name + ']';
    }

    getVisibleToPlayer() {
        return this.learned ||
            this.parents.some(p => p.node.learned) ||
            this.parents.some(p => p.node.parents.some(pp => pp.node.learned));
    }

    getColorClass(character) {
        if(this.learned) return 't';
        if(!this.getCharacterQualified()) return 'd';
        if(this.parents.some(p => p.node.learned)) return 'n';
        return 'd';
    }

    getCharacterQualified(character) {
        // TODO
        return true;
    }
}

class TreeParser{
    constructor() {
        this.nodes = [];
        this.treeSource = null;
        this.rows = 0;
        this.cols = 0;
    }

    parse(treeText) {
        // remove labels
        treeText = treeText.replace(/^[a-zA-Z0-9,._\- ]:/g, m => " ".repeat(m.length));
        // clean up spacing
        treeText = treeText.replace(/- \[/g, "--[");
        treeText = treeText.replace(/\] -/g, "]--");
        // split by line
        this.treeSource = treeText.split('\n');

        // pull out tier headers
        const header = this.treeSource.shift();
        const tierHeaderRegex = /Tier ?[0-9]+/gi;
        this.tierPositions = [];
        let match;
        while(match = tierHeaderRegex.exec(header)) {
            this.tierPositions.push(match.index);
        }

        // set attributes
        this.rows = this.treeSource.length;
        this.cols = Math.max(...this.treeSource.map(line => line.length));

        // search for nodes till we build the whole tree
        this.nodePosMap = {};
        this.nodesClosed = {};
        this.nodesFringe = this.getRootNodes();
        this.nodesFringe.forEach(n => this.nodePosMap[n.getHash()] = n);

        while(this.nodesFringe.length) {
            const current = this.nodesFringe.pop();
            const currentHash = current.getHash();
            if(this.nodesClosed[currentHash]) continue;
            this.nodesClosed[currentHash] = true;

            // determine current's children
            const rightIndex = current.rightIndex;
            const followingCurrent = this.treeSource[current.row].substr(rightIndex);
            if(/^[ ]*([^- ]|$)/.test(followingCurrent)) {
                // no children
                continue;
            }

            // add the child paths and children
            const pathHeader = `${current.row}:${current.rightIndex}:`;
            this.followPathRight(current.row, current.rightIndex, pathHeader, current);
        }

        let result = new MagicTree(this.rows, this.cols);
        for(let pos in this.nodePosMap) {
            let n = this.nodePosMap[pos];
            n.tier = this.getTierForNode(n);
            n.children.forEach(c => {
                const childNode = c.node;
                // convert path strings to MagicTreePath objects
                const childPath = new MagicTreePath(c.path, n, childNode);
                c.path = childPath;
                childNode.parents.push({node: n, path: childPath});
            })
            result.addNode(n);
        }
        return result;
    }

    getTierForNode(n) {
        let col = n.col;
        for(let i=0; i<this.tierPositions.length; i++) {
            const t = this.tierPositions[i];
            if(Math.abs(col - t) <= 1) return i;
        }
        throw "Misaligned node error! Line " + (n.row + 2) + " node:" + n.source;
    }

    getRootNodes() {
        const result = [];
        const searchRegex = /(^|\] ) *\[/g;
        this.treeSource.forEach((line, lineIndex) => {
            let match;
            while(match = searchRegex.exec(line)) {
                const nodePos = new MagicTreeNode(this.treeSource, lineIndex, match.index + match[0].length - 1);
                result.push(nodePos);
            }
        });
        return result;
    }

    addChild(row, col, pathBefore, parentNode) {
        // add child at row, col and path to parentNode
        const childHash = row + " " + col;
        let childNode = this.nodePosMap[childHash];
        if(!childNode) {
            childNode = new MagicTreeNode(this.treeSource, row, col);
            this.nodePosMap[childHash] = childNode;
            this.nodesFringe.push(childNode);
        }
        parentNode.children.push({
            path: pathBefore,
            node: childNode,
        });
    }

    // Paths:
    // row:col:[SD]*
    // D: direction, u = up, r = right, d = down
    // S: symbol, | or + or >
    followPathRight(row, col, pathBefore, parentNode) {
        if(col > this.treeSource[row].length - 1) return;
        // the symbol at row, col should not already be in the path
        // path should end with a direction
        const symbol = this.symbolAt(row, col);
        pathBefore += symbol;
        if(symbol == '-' || symbol == '>') {
            this.followPathRight(row, col+1, pathBefore + "r", parentNode);
        }else if(symbol == '+') {
            this.followPathRight(row, col+1, pathBefore + "r", parentNode);
            this.followPathUp(row-1, col, pathBefore + "u", parentNode);
            this.followPathDown(row+1, col, pathBefore + "d", parentNode);
        }else if(symbol == '[') {
            this.addChild(row, col, pathBefore.substr(0, pathBefore.length-2), parentNode);
        }else if(symbol == '\n' || symbol == ' ') {
            return; // end of the line
        }else{
            // error
            throw "Magic tree parse error at " + row + ", " + col;
        }
    }

    followPathUp(row, col, pathBefore, parentNode) {
        if(row < 0) return;
        if(col > this.treeSource[row].length - 1) return;
        const symbol = this.symbolAt(row, col);
        pathBefore += symbol;
        if(symbol == '|') {
            this.followPathUp(row-1, col, pathBefore + "u", parentNode);
        }else if(symbol == '>') {
            this.followPathUp(row-1, col, pathBefore + "u", parentNode);
            this.followPathRight(row, col+1, pathBefore + "r", parentNode);
        }else if(symbol == ' ' || symbol == '\n') {
            return;
        }else{
            throw "Magic tree parse error at " + row + ", " + col;
        }
    }

    followPathDown(row, col, pathBefore, parentNode) {
        if(row > this.treeSource.length - 1) return;
        if(col > this.treeSource[row].length - 1) return;
        const symbol = this.symbolAt(row, col);
        pathBefore += symbol;
        if(symbol == '|') {
            this.followPathDown(row+1, col, pathBefore + "d", parentNode);
        }else if(symbol == '>') {
            this.followPathDown(row+1, col, pathBefore + "d", parentNode);
            this.followPathRight(row, col+1, pathBefore + "r", parentNode);
        }else if(symbol == ' ' || symbol == '\n') {
            return;
        }else{
            throw "Magic tree parse error at " + row + ", " + col;
        }
    }

    symbolAt(row, col) {
        return this.treeSource[row][col];
    }
}



// let p = new TreeParser();

// const fs = require('fs');
// fs.readFile("magicTree.txt", 'utf-8', (err, data) => {
//     // console.log(data);
//     const tree = p.parse(data);
//     // tree.nodes.forEach((n, i) => console.log(i, n.name));
//     tree.nodeMap.magicMissile1.learned = true;
//     tree.nodeMap.lightning1.learned = true;
//     tree.nodeMap.weaken.learned = true;
//     tree.nodeMap.flood.learned = true;
//     // tree.nodes[1].children[0].node.learned = true;
//     console.log(tree.toString(true));
// });
