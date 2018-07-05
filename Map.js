class ObjectSet {
    constructor(g) {
        this.group = g;
        this.objects = [];
        this.shouldBeVisible = false;
    }

    push(o) {
        this.objects.push(o);
        this.group.add(o);
        if(this.shouldBeVisible) {
            o.visible = true;
        }
    }

    setVisible(b = true) {
        this.shouldBeVisible = b;
        this.objects.forEach(o => o.visible = b);
    }

    forEach(...args) {
        return this.objects.forEach(...args);
    }

    map(...args) {
        return this.objects.map(...args);
    }
}

class Cell{
    constructor(map, x, y, type = 'wall') {
        this.map = map;
        this.x = x;
        this.y = y;
        this.type = type;
        this.doorOpen = false;
        this.desiredDoorRotation = 0;
        this.currentDoorRotation = 0;
        this.zoneIndex = -1;
        this.room = null;

        this.wallWVisibleToPlayer = false;
        this.wallSVisibleToPlayer = false;
        this.wallEVisibleToPlayer = false;
        this.wallNVisibleToPlayer = false;
        this.visibleToPlayer = false;

        // my meshes
        const g = this.objectGroup = new THREE.Group();
        this.objects = {
            wallN: new ObjectSet(g),
            wallS: new ObjectSet(g),
            wallE: new ObjectSet(g),
            wallW: new ObjectSet(g),
            cornerNE: new ObjectSet(g),
            cornerNW: new ObjectSet(g),
            cornerSW: new ObjectSet(g),
            cornerSE: new ObjectSet(g),
            door: new ObjectSet(g),
            main: new ObjectSet(g),
        };
    }

    isWall() {
        return this.type == 'wall';
    }

    hasFloor() {
        return this.type != 'wall' && this.type != 'water' && this.type != 'stairs';
    }

    blocksLOS() {
        return this.type == 'wall' || (this.type == 'door' && this.doorOpen == false);
    }

    cellN() { return this.map.at(this.x, this.y+1); }
    cellS() { return this.map.at(this.x, this.y-1); }
    cellE() { return this.map.at(this.x+1, this.y); }
    cellW() { return this.map.at(this.x-1, this.y); }

    cellNE() { return this.map.at(this.x+1, this.y+1); }
    cellNW() { return this.map.at(this.x-1, this.y+1); }
    cellSE() { return this.map.at(this.x+1, this.y-1); }
    cellSW() { return this.map.at(this.x-1, this.y-1); }

    isEmptyArea() {
        // returns true if this cell and all adjacent cells are of type wall
        return this.type == 'wall' &&
            this.cellN().type == 'wall' &&
            this.cellS().type == 'wall' &&
            this.cellE().type == 'wall' &&
            this.cellW().type == 'wall' &&
            this.cellNE().type == 'wall' &&
            this.cellNW().type == 'wall' &&
            this.cellSE().type == 'wall' &&
            this.cellSW().type == 'wall';
    }

    isAlmostEmptyArea() {
        // returns true if this cell and all but one adjacent cells are of type wall
        return this.type == 'wall' &&
            (
                (this.cellN().type == 'wall') +
                (this.cellS().type == 'wall') +
                (this.cellE().type == 'wall') +
                (this.cellW().type == 'wall') +
                (this.cellNE().type == 'wall') +
                (this.cellNW().type == 'wall') +
                (this.cellSE().type == 'wall') +
                (this.cellSW().type == 'wall')
            ) >= 7;
    }

    getAdjacentZones(zoneTree) {
        const adjacentZones = [
            zoneTree.getRootZone(this.cellE().zoneIndex),
            zoneTree.getRootZone(this.cellN().zoneIndex),
            zoneTree.getRootZone(this.cellW().zoneIndex),
            zoneTree.getRootZone(this.cellS().zoneIndex),
        ].filter(z => z != -1);
        return _.uniq(adjacentZones);
    }

    adjacentTo(other) {
        return Math.abs(other.x - this.x) + Math.abs(other.y - this.y) <= 1;
    }

    getWallProfile() {
        const walls = [
            this.cellE().type,
            this.cellN().type,
            this.cellW().type,
            this.cellS().type
        ];
        return walls.map(w => ({
            'wall': 'w',
            'blank': 'b',
        })[w] || 'e').join('');
    }

    setWallVisible(side) {
        switch(side) {
            case 'w':
                this.wallWVisibleToPlayer = true;
                this.objects.wallW.setVisible();
                this.cellS().objects.cornerNW.setVisible();
                this.cellN().objects.cornerSW.setVisible();
                break;
            case 's':
                this.wallSVisibleToPlayer = true;
                this.objects.wallS.setVisible();
                this.cellW().objects.cornerSE.setVisible();
                this.cellE().objects.cornerSW.setVisible();
                break;
            case 'e':
                this.wallEVisibleToPlayer = true;
                this.objects.wallE.setVisible();
                this.cellS().objects.cornerNE.setVisible();
                this.cellN().objects.cornerSE.setVisible();
                break;
            case 'n':
                this.wallNVisibleToPlayer = true;
                this.objects.wallN.setVisible();
                this.cellW().objects.cornerNE.setVisible();
                this.cellE().objects.cornerNW.setVisible();
                break;
        }
        this.objects.door.setVisible();
        this.objects.main.setVisible();
        // set corners visible
    }

    setDoorOpen(state) {
        if(this.doorOpen == state) return;
        this.doorOpen = state;
        this.desiredDoorRotation += state ? -1 : 1;
    }
}

class Room{
    constructor(zoneIndex) {
        this.zoneIndex = zoneIndex;
    }
}

class ZoneTree{
    constructor() {
        this.parents = [];
        this.sizes = [];
    }

    addZone(size) {
        this.sizes[this.parents.length] = size;
        this.parents.push(this.parents.length);
    }

    getRootZone(z) {
        if(z == -1) return -1;
        while(this.parents[z] != z) {
            z = this.parents[z];
        }
        return z;
    }

    setRoot(z, rootZone) {
        if(z == rootZone) return;
        this.parents[z] = rootZone;
        this.sizes[rootZone] += this.sizes[z];
        this.sizes[z] = 0;
    }

    getRootZones() {
        return this.parents.filter((p, i) => p == i);
    }

    getLargestZone() {
        const maxSize = Math.max(...this.sizes);
        return this.parents.filter(p => this.sizes[p] == maxSize)[0];
    }
}

class Map{
    constructor(width, height, layout = '') {
        this.width = width;
        this.height = height;

        if(layout != '') {
            this.cells = layout.split('\n').map(row => row.trim()).filter(row => row != '').reverse().map((row, y) => {
                return row.split(' ').map((c, x) => {
                    const type = ({
                        '1': 'wall',
                        '0': 'floor',
                        'd': 'door',
                        'w': 'water',
                        's': 'stairs',
                    })[c];
                    return new Cell(this, x, y, type);
                });
            });
        }else{
            this.cells = [];
            for(let y=0; y < height; y++) {
                this.cells.push([]);
                for(let x=0; x < width; x++) {
                    const onEdge = x == 0 || y == 0 || x == width-1 || y == height-1;
                    this.cells[y][x] = new Cell(this, x, y, onEdge ? 'blank' : 'wall');
                }
            }
            this.generate();
        }

        // remember door cells so we can update door angles without having to search through all cells
        this.movingCells = [];
        this.forEachCell(c => {
            if(c.type == 'door') {
                this.movingCells.push(c);
            }
        });
    }

    generate() {
        // generate a map!
        const w = this.width;
        const h = this.height;

        this.rooms = [];

        // square maps look weird, force the map to be round
        this.forEachCell(c => {
            let x = 2 * c.x / w - 1;
            let y = 2 * c.y / h - 1;
            if(x*x + y*y >= 1) {
                c.type = 'blank';
            }
        });

        // make a zone tree to keep track of what's zonnected
        const zoneTree = new ZoneTree();

        // add random rooms
        let failures = 0;
        let zoneIndex = 0;
        while(failures < 75) {
            let roomX = randInt(0, w);
            let roomY = randInt(0, h);
            let roomW = randInt(5, 10); // includes walls
            let roomH = randInt(5, 10); // includes walls
            const clear = this.checkClear(roomX, roomY, roomW, roomH);
            if(clear) {
                if(rand(0, 1) < 0.2) {
                    this.addDeadZone(roomX, roomY, roomW, roomH);
                }else{
                    const zoneSize = this.addRoom(roomX, roomY, roomW, roomH, zoneIndex++);
                    zoneTree.addZone(zoneSize);
                }
            }else{
                failures++;
            }
        }

        // fill the rest of the map with passageways
        let startPoint;
        while(startPoint = this.findEmptyArea()) {
            const zoneSize = this.makeMaze(startPoint, zoneIndex++);
            zoneTree.addZone(zoneSize);
        }

        // connect different zones
        let numZones = zoneIndex;

        let walls = [];
        this.forEachCell(c => {
            if(c.type == 'wall') walls.push(c);
        });

        while(numZones > 1) {
            walls = walls.filter(c => {
                return c.getAdjacentZones(zoneTree).length > 1;
            });

            if(walls.length == 0) break; // no way to connect more zones

            // choose a wall to break at random
            const c = randChoice(walls);

            // merge the zones
            let zones = c.getAdjacentZones(zoneTree);
            const rootZone = Math.min(...zones);
            zones.forEach(z => zoneTree.setRoot(z, rootZone));
            numZones -= zones.length - 1;

            // and add a door
            c.type = 'door';
            c.zoneIndex = rootZone;
            zoneTree.sizes[rootZone]++;
        }

        // we connected all we could, now clean up anything unconnected
        if(numZones > 1) {
            if(numZones > 7) {
                console.warn('removing zones ('+(numZones-1)+')');
            }

            // we need to clean up the left over small zones
            // also remove any rooms that get purged
            const primaryZone = zoneTree.getLargestZone();
            this.rooms = this.rooms.filter(r => zoneTree.getRootZone(r.zoneIndex) == primaryZone);

            this.forEachCell(c => {
                if(c.zoneIndex != -1 && zoneTree.getRootZone(c.zoneIndex) != primaryZone) {
                    // fill it in
                    c.type = 'wall';
                }
            });
        }

        // add some random doors
        const desiredDoorCount = this.rooms.length * 2.5;
        let currentDoorCount = 0;
        let extraDoorCells = [];
        this.forEachCell(c => {
            if(c.type == 'door') currentDoorCount++;
            if(c.type == 'wall') extraDoorCells.push(c);
        });
        while(currentDoorCount < desiredDoorCount) {
            extraDoorCells = extraDoorCells.filter(c => {
                if(!c.isWall()) return false;
                const p = c.getWallProfile();
                return p == 'wewe' || p == 'ewew';
            });
            if(extraDoorCells.length == 0) break;

            const newDoor = randChoice(extraDoorCells);
            newDoor.type = 'door';
            currentDoorCount++;
        }

        // done adding doors
        console.log('Door success: ', currentDoorCount / desiredDoorCount);

        // remove some of the dead ends
        function isDeadEnd(c) {
            if(c.room != null || c.isWall()) return false;
            const p = c.getWallProfile();
            return p == 'ewww' || p == 'weww' || p == 'wwew' || p == 'wwwe';
        }
        let deadEnds = this.filterCells(isDeadEnd);
        deadEnds = deadEnds.filter(c => Math.random() > 0); // only remove some dead ends
        while(deadEnds.length) {
            const c = deadEnds.pop();
            c.type = 'wall';
            // add any adjacent dead ends to the list
            deadEnds.push(...[
                c.cellE(),
                c.cellN(),
                c.cellW(),
                c.cellS(),
            ].filter(isDeadEnd));
        }

        // remove some doors that connect hallways to each other
        this.filterCells(c => c.type == 'door').filter(c => {
            // exclude doors adjacent to rooms
            return !(c.cellE().room || c.cellN().room || c.cellW().room || c.cellS().room);
        }).filter(c => Math.random() > 0.5).forEach(c => c.type == 'floor');

        // remove any doors in corners. Not sure how that happened but it did.
        this.filterCells(c => c.type == 'door').filter(c => {
            const p = c.getWallProfile();
            return p != 'wewe' && p != 'ewew';
        }).forEach(c => c.type == 'floor');

        // convert blank spots to wall
        this.forEachCell(c => {
            if(c.type == 'blank') c.type = 'wall';
        });

        this.consoleDump();
    }

    findEmptyArea() {
        // returns the first cell that is completely surrounded by wall cells
        for(let x = 1; x < this.width - 1; x++) {
            for(let y = 1; y < this.height - 1; y++) {
                const c = this.cells[y][x];
                if(c.isEmptyArea()) return c;
            }
        }
        return false;
    }

    checkClear(x1, y1, w, h) {
        // check that all the tiles in this range are of type wall
        for(let x = x1; x < x1+w; x++) {
            for(let y = y1; y < y1+h; y++) {
                if(this.at(x, y).type != 'wall') return false;
            }
        }
        return true;
    }

    addRoom(x1, y1, w, h, zoneIndex) {
        let room = new Room(zoneIndex);
        this.rooms.push(room);

        for(let x = x1+1; x < x1+w-1; x++) {
            for(let y = y1+1; y < y1+h-1; y++) {
                const c = this.at(x, y);
                c.type = 'floor';
                c.zoneIndex = zoneIndex;
                c.room = room;
            }
        }
        // TODO: add irregular shape possibility

        return (w-2) * (h-2);
    }

    addDeadZone(x1, y1, w, h) {
        for(let x = x1+1; x < x1+w-1; x++) {
            for(let y = y1+1; y < y1+h-1; y++) {
                this.at(x, y).type = 'blank';
            }
        }
    }

    makeMaze(startPoint, zoneIndex) {
        startPoint.type = 'floor';
        startPoint.zoneIndex = zoneIndex;
        let numAddedToZone = 1;

        while(true) {
            // dig either one or two in a direction
            const choices = [
                [['E'], startPoint.cellE().isAlmostEmptyArea()],
                [['N'], startPoint.cellN().isAlmostEmptyArea()],
                [['W'], startPoint.cellW().isAlmostEmptyArea()],
                [['S'], startPoint.cellS().isAlmostEmptyArea()],
                [['E', 'E'], startPoint.cellE().cellE().isEmptyArea()],
                [['N', 'N'], startPoint.cellN().cellN().isEmptyArea()],
                [['W', 'W'], startPoint.cellW().cellW().isEmptyArea()],
                [['S', 'S'], startPoint.cellS().cellS().isEmptyArea()],
            ].filter(choice => choice[1]);

            // if we hit a dead end return
            if(choices.length == 0) return numAddedToZone;

            // randomly die sometimes, helps avoid long straight passageways
            // also helps to add more doors in the final result
            if(rand(0, 1) < 0.1) return numAddedToZone;

            // dig out the direction we chose
            let currentPoint = startPoint;
            const directions = randChoice(choices)[0];
            directions.forEach(d => {
                currentPoint = currentPoint['cell'+d]();
                currentPoint.type = 'floor';
                currentPoint.zoneIndex = zoneIndex;
            });
            numAddedToZone += directions.length - 1;

            // recurse
            numAddedToZone += this.makeMaze(currentPoint, zoneIndex);
        }
        return numAddedToZone;
    }


    consoleDump(showZones = false) {
        let s = this.cells.map(row => {
            return row.map(c => {
                if(showZones && c.type == 'floor') return ("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")[showZones.getRootZone(c.zoneIndex)];
                return ({
                    door: 'd',
                    water: '~',
                    blank: '!',
                    wall: '#',
                    floor: '.',
                    stairs: 's',
                })[c.type];
            }).join(' ');
        }).reverse().join('\n');
        console.log(s);
    }

    contains(x, y) {
        return !(x < 0 || y < 0 || x >= this.width || y >= this.height);
    }

    at(x, y) {
        if(this.contains(x, y)) {
            return this.cells[y][x];
        }else{
            return new Cell(this, x, y);
        }
    }

    forEachCell(cb) {
        this.cells.forEach(row => {
            row.forEach(cell => {
                cb(cell);
            });
        });
    }

    mapCells(cb) {
        const result = [];
        this.cells.forEach(row => {
            row.forEach(cell => {
                result.push(cb(cell));
            });
        });
        return result;
    }

    filterCells(cb) {
        const result = [];
        this.cells.forEach(row => {
            row.forEach(cell => {
                if(cb(cell)) result.push(cell);
            });
        });
        return result;
    }
}
