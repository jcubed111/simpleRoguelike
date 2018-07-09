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
        this.lightSpec = null;

        this.wallDecorN = 'none';
        this.wallDecorS = 'none';
        this.wallDecorE = 'none';
        this.wallDecorW = 'none';

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

    isPit() {
        return this.type == 'pit';
    }

    hasFloor() {
        return this.type != 'wall' && this.type != 'water' && this.type != 'stairs' && this.type != 'pit';
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

    occupiedBy() {
        return _.find(this.map.characters, e => e.x == this.x && e.y == this.y) || false;
    }

    generateBaseInfo() {
        return `
%t${this.type}
A plain section of %n${this.type}
%dIt appears to have been here for a long time, but you can't tell how long without some chronology tools.
        `;
    }

    generateItemInfo() {
        // TODO
        return "";
    }
    generateCharacterInfo() {
        const o = this.occupiedBy();
        if(!o) return "";
        return o.generateInfoBlock();
    }
}

class RoomLight{
    constructor(xmin, ymin, xmax, ymax) {
        this.w = xmax - xmin;
        this.h = ymax - ymin;
        this.x = (xmin + xmax) / 2;
        this.y = (ymin + ymax) / 2;

        this.light = new THREE.RectAreaLight(0x00ffaa, 2.0, this.w, this.h);
        this.light.position.set(this.x, this.y, 0.9);
        this.light.setRotationFromAxisAngle(new Vec3(1, 0, 0), Math.PI); // point down
        this.light.visible = false;
    }

    setVisible(visible) {
        this.light.visible = visible;
    }
}

class CellLightSpec{
    constructor(pos, color, intensity) {
        this.pos = pos;
        this.type = 'unknown';
        this.lightProps = {};
        this.lightProps.color = new THREE.Color(color);
        this.lightProps.intensity = intensity;
    }

    setLightProps(light) {
        // set the necessary props on light to make it match with this spec
        light.position.set(this.pos.x, this.pos.y, this.pos.z);
        _.extend(light, this.lightProps);
    }

    dist2(player) {
        return Math.pow(this.pos.x - player.x, 2) + Math.pow(this.pos.y - player.y, 2);
    }
}

class CellPointLightSpec extends CellLightSpec{
    constructor(pos, color, intensity, distance, decay) {
        super(pos, color, intensity);
        this.type = 'PointLight';
        this.lightProps.distance = distance;
        this.lightProps.decay = decay;
    }
}

class Room{
    constructor(map, x1, y1, w, h, zoneIndex) {
        this.map = map;
        this.x1 = this.centerX1 = x1;
        this.y1 = this.centerY1 = y1;
        this.w = w;
        this.h = h;
        this.x2 = this.centerX2 = x1+w;
        this.y2 = this.centerY2 = y1+h;
        this.zoneIndex = zoneIndex;

        this.light = null;
    }

    buildPart1() {
        // part of room that gets built before there are doors
        // only dig
        const map = this.map;

        for(let x = this.x1+1; x < this.x2-1; x++) {
            for(let y = this.y1+1; y < this.y2-1; y++) {
                const c = map.at(x, y);
                c.type = 'floor';
                c.zoneIndex = this.zoneIndex;
                c.room = this;
            }
        }

        /* room features */
        // columns
        if(this.w > 5 && this.h > 5 && oneIn(3)) {
            const x = randInt(this.x1+2, this.x2-2);
            const y = randInt(this.y1+2, this.y2-2);
            map.at(x, y).type = 'wall';
            map.at(x, y).zoneIndex = -1;
            map.at(x, y).room = null;
        }

        // corner rounding
        const xmin = this.x1+1;
        const ymin = this.y1+1;
        const xmax = this.x2-2;
        const ymax = this.y2-2;
        const cornerRoundOptions = [
            [], [], [], [], [], [],
            [map.at(xmin, ymin), this.w < this.h ? '+y' : '+x'],
            [map.at(xmin, ymax), this.w < this.h ? '-y' : '+x'],
            [map.at(xmax, ymax), this.w < this.h ? '-y' : '-x'],
            [map.at(xmax, ymin), this.w < this.h ? '+y' : '-x'],
            [map.at(xmin, ymin), map.at(xmin+1, ymin), '+y'],
            [map.at(xmin, ymin), map.at(xmin, ymin+1), '+x'],
            [map.at(xmin, ymax), map.at(xmin+1, ymax), '-y'],
            [map.at(xmin, ymax), map.at(xmin, ymax-1), '+x'],
            [map.at(xmax, ymax), map.at(xmax-1, ymax), '-y'],
            [map.at(xmax, ymax), map.at(xmax, ymax-1), '-x'],
            [map.at(xmax, ymin), map.at(xmax-1, ymin), '+y'],
            [map.at(xmax, ymin), map.at(xmax, ymin+1), '-x'],
        ];
        if(this.w > 5 || this.h > 5) {
            const wallsToAdd = randChoice(cornerRoundOptions);
            const centerSizeToDecrease = wallsToAdd.pop();
            wallsToAdd.forEach(c => {
                c.type = 'wall';
                c.zoneIndex = -1;
                c.room = null;
            });
            switch(centerSizeToDecrease) {
                case '+x': this.centerX1++; break;
                case '-x': this.centerX2--; break;
                case '+y': this.centerY1++; break;
                case '-y': this.centerY2--; break;
            }
        }

        return (this.w-2) * (this.h-2);
    }

    buildPart2() {
        // part of room that gets built after there are doors
        this.type = randChoice([
            'plain', 'plain', 'plain',
            'water',
            // 'pit',
        ]);
        this['buildAs_'+this.type]();
        this.populate(randInt(0, 4));
    }

    buildAs_water() {
        // choose a water generation method
        const genType = randChoice([
            'genWaterPool',
            'genWaterVoronoi',
            'genRiver',
        ]);
        this[genType]();

        this.light = new RoomLight(this.centerX1+1, this.centerY1+1, this.centerX2-2, this.centerY2-2);
    }

    genWaterPool() {
        const map = this.map;

        for(let x = this.x1+2; x < this.x2-2; x++) {
            for(let y = this.y1+2; y < this.y2-2; y++) {
                const c = map.at(x, y);
                if(c.type != 'floor') continue;
                c.type = 'water';
            }
        }
    }

    genWaterVoronoi() {
        const map = this.map;

        let points = [1, 1, 1, 1, 0, 0, 0, 0].map(isWater => {
            return [rand(this.x1+1, this.x2-1), rand(this.y1+1, this.y1-1), isWater];
        });

        for(let x = this.x1+1; x < this.x2-1; x++) {
            for(let y = this.y1+1; y < this.y2-1; y++) {
                const c = map.at(x, y);
                if(c.type != 'floor') continue;

                const closestPoint = _.minBy(points, ([px, py, isWater]) => Math.pow(x-px, 2) + Math.pow(y-py, 2));
                if(closestPoint[2]) {
                    c.type = 'water';
                }
            }
        }
    }

    genRiver(riverType = 'water') {
        const map = this.map;

        // choose river direction
        const direction = randChoice(['N', 'S', 'E', 'W']);
        const nextCellChoices = ({
            N: ['N', 'E', 'W'],
            S: ['S', 'E', 'W'],
            E: ['E', 'N', 'S'],
            W: ['W', 'N', 'S'],
        })[direction];

        // get a cell along one wall
        let startCell = ({
            N: map.at(Math.floor(this.x1 + this.w/2), this.y1+1),
            S: map.at(Math.floor(this.x1 + this.w/2), this.y2-2),
            E: map.at(this.x1+1, Math.floor(this.y1 + this.h/2)),
            W: map.at(this.x2-2, Math.floor(this.y1 + this.h/2)),
        })[direction];

        // build the river
        while(startCell.room == this) {
            if(startCell.type == 'floor') {
                startCell.type = riverType;
            }
            startCell = startCell[randChoice([
                'cell' + nextCellChoices[0],
                'cell' + nextCellChoices[0],
                'cell' + nextCellChoices[0],
                'cell' + nextCellChoices[1],
                'cell' + nextCellChoices[2],
            ])]();
        }
    }

    buildAs_plain() {
        // pass, just a plain room
    }

    buildAs_pit() {
        const map = this.map;

        this.genRiver('pit');

        for(let x = this.x1+1; x < this.x2-1; x++) {
            for(let y = this.y1+1; y < this.y2-1; y++) {
                const c = map.at(x, y);
                if(c.type != 'pit') continue;
                if(c.cellN().type == 'door'
                    || c.cellS().type == 'door'
                    || c.cellE().type == 'door'
                    || c.cellW().type == 'door'
                ) {
                    c.type = 'floor';
                }
            }
        }
    }

    getCells() {
        const result = [];
        for(let x = this.x1+1; x < this.x2-1; x++) {
            for(let y = this.y1+1; y < this.y2-1; y++) {
                const c = this.map.at(x, y);
                if(c.room == this) {
                    result.push(c);
                }
            }
        }
        return result;
    }

    populate(numEnemies) {
        const map = this.map;

        let floorCells = this.getCells().filter(c => c.type == 'floor' || c.type == 'water');
        floorCells = _.shuffle(floorCells);

        while(floorCells.length && numEnemies > 0) {
            const cell = floorCells.pop();
            const enemyType = ({
                floor: enemyTypes.Kobold,
                water: enemyTypes.Piranha,
            })[cell.type];
            const enemy = new enemyType(this.map.world, 1);
            enemy.x = cell.x;
            enemy.y = cell.y;
            this.map.characters.push(enemy);
            numEnemies--;
        }
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
    constructor(world, width, height, layout = '') {
        this.world = world;
        this.rooms = [];
        this.width = width;
        this.height = height;
        this.characters = [];

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

        // remember certain cells so we can update them without having to search through all cells
        this.dynamicCells = [];
        this.forEachCell(c => {
            if(
                c.type == 'door' ||
                c.lightSpec
            ) {
                this.dynamicCells.push(c);
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
        while(failures < w*h*0.1) {
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
        }).forEach(c => c.type = 'floor');

        // convert blank spots to wall
        this.forEachCell(c => {
            if(c.type == 'blank') c.type = 'wall';
        });

        // finish building rooms
        this.rooms.forEach(r => r.buildPart2());

        // lighting zone map
        const lightInZone = {};

        // add hallway lighting fixtures
        this.forEachCell(c => {
            if(c.room == null && c.type == 'floor') {
                const zone = Math.floor(c.x/5) + ' ' + Math.floor(c.y/5);
                if(lightInZone[zone]) return;

                const adjacentWalls = [
                    [c.cellE(), 'W', 0.3, 0],
                    [c.cellN(), 'S', 0, 0.3],
                    [c.cellW(), 'E', -0.3, 0],
                    [c.cellS(), 'N', 0, -0.3],
                ].filter(([cell, side]) => cell.isWall());
                if(adjacentWalls.length == 0) return;

                if(!oneIn(5)) return;
                const [wallCell, side, lx, ly] = randChoice(adjacentWalls);
                const lightType = randChoice([
                    'torch', 'torch', 'torch',
                    'mushroomGrove'
                ]);

                // add a lighting decoration to the wall
                wallCell['wallDecor' + side] = lightType;
                switch(lightType) {
                    case 'torch':
                        c.lightSpec = new CellPointLightSpec(
                            new Vec3(c.x+lx, c.y+ly, 0.8),
                            0xff7700,
                            5.0,
                            1.5,
                            1.4
                        );
                        break;
                    case 'mushroomGrove':
                        c.lightSpec = new CellPointLightSpec(
                            new Vec3(c.x+lx, c.y+ly, 0.2),
                            0xff11cc,
                            4.0,
                            1.5,
                            1.4
                        );
                        break;
                }
                lightInZone[zone] = true;
            }
        });

        // this.consoleDump();
        this.htmlDump();
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
        let room = new Room(this, x1, y1, w, h, zoneIndex);
        this.rooms.push(room);

        return room.buildPart1();
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
                    pit: '%',
                })[c.type];
            }).join(' ');
        }).reverse().join('\n');
        console.log(s);
    }

    htmlDump() {
        let s = this.cells.map((row, y) => {
            return row.map((c, x) => {
                return `<span class="cell ${c.type}" data-x="${x}" data-y="${y}"></span>`;
            }).join('');
        }).reverse().join('</div><div class="row">');
        document.getElementById('mapView').innerHTML = '<div class="row">' + s + '</div>';
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
