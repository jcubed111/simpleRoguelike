class ObjectSet {
    constructor() {
        this.objects = [];
        this.shouldBeVisible = false;
    }

    push(o) {
        this.objects.push(o);
        o.visible = this.shouldBeVisible;
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

        this.wallWVisibleToPlayer = false;
        this.wallSVisibleToPlayer = false;
        this.wallEVisibleToPlayer = false;
        this.wallNVisibleToPlayer = false;
        this.visibleToPlayer = false;

        // my meshes
        this.objects = {
            wallN: new ObjectSet(),
            wallS: new ObjectSet(),
            wallE: new ObjectSet(),
            wallW: new ObjectSet(),
            cornerNE: new ObjectSet(),
            cornerNW: new ObjectSet(),
            cornerSW: new ObjectSet(),
            cornerSE: new ObjectSet(),
            door: new ObjectSet(),
            main: new ObjectSet(),
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

    getWallProfile() {
        const walls = [
            this.cellE().isWall(),
            this.cellN().isWall(),
            this.cellW().isWall(),
            this.cellS().isWall()
        ];
        return walls.map(w => w ? 'w' : 'e').join('');
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
                    this.cells[y][x] = new Cell(this, x, y);
                }
            }
        }

        // set door cells so we can update door angles without having to search through all cells
        this.movingCells = [];
        this.forEachCell(c => {
            if(c.type == 'door') {
                this.movingCells.push(c);
            }
        });
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
}
