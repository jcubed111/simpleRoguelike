const Vec3 = THREE.Vector3;

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function randChoice(choices) {
    return choices[Math.floor(Math.random() * choices.length)];
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
    }

    isWall() {
        return this.type == 'wall';
    }

    hasFloor() {
        return this.type != 'wall' && this.type != 'water' && this.type != 'stairs';
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

    at(x, y) {
        if(x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return new Cell(this, x, y);
        }
        return this.cells[y][x];
    }

    forEachCell(cb) {
        this.cells.forEach(row => {
            row.forEach(cell => {
                cb(cell);
            });
        });
    }
}

class Player {
    constructor(world, x, y) {
        this.world = world;
        this.x = x;
        this.y = y;
    }

    tryToMove(dx, dy) {
        const oldCell = this.world.map.at(this.x, this.y);
        const newCell = this.world.map.at(this.x + dx, this.y + dy);
        if(!newCell.isWall()) {
            this.x += dx;
            this.y += dy;
        }else{
            return false;
        }

        // if we moved, set door states
        if(oldCell.type == 'door') {
            oldCell.setDoorOpen(false);
        }
        if(newCell.type == 'door') {
            newCell.setDoorOpen(true);
        }
    }
}

class World{
    constructor() {
        this.map = new Map(9, 9, `
            1 1 1 1 1 1 1 1 1
            1 0 0 0 1 1 1 s 1
            1 0 1 0 0 0 0 0 1
            1 0 0 1 1 1 d 1 1
            1 1 0 1 1 0 0 0 1
            1 1 0 1 1 0 0 0 1
            1 0 0 0 d 0 w w 1
            1 s 1 1 1 0 w 0 1
            1 1 1 1 1 1 1 1 1
        `);

        this.player = new Player(this, 1, 1);
    }
}

class WorldView {
    constructor(world) {
        this.panSpeed = 0.09; // how fast the camera moves, (0, 1]. 1 = instant
        this.doorOpenSpeed = 0.08; // how fast doors open, (0, 1]. 1 = instant

        this.world = world;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
        this.camera.up.set(0, 0, 1);
        this.camPos = new Vec3(world.player.x, world.player.y, 0);
        this.lastFrameTime = 0;

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.shadowMap.enabled = true;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        /* background lighting */
        var keyLight = new THREE.DirectionalLight(0xffffcc, 0.5);
        keyLight.position.set(-7, -10, 10);
        // keyLight.castShadow = true;
        this.scene.add(keyLight);

        var fillLight = new THREE.AmbientLight(0x777777ff, 0.5);
        this.scene.add(fillLight);

        /* player light */
        this.playerLight = new THREE.PointLight(0xff8811, 2.0, 5);
        this.playerLight.position.set(0, 0, 0.9);
        this.playerLight.castShadow = true;
        this.playerLight.shadow.camera.far = this.playerLight.distance;
        this.playerLight.shadow.camera.near = 0.1;
        this.scene.add(this.playerLight);

        /* environment lighting */
        var waterLight = new THREE.PointLight(0x00ffaa, 1.0, 4.0, 1.0);
        waterLight.position.set(6, 2.5, 0.2);
        waterLight.shadow.camera.far = 5;
        waterLight.castShadow = true;
        this.scene.add(waterLight);

    }

    render(time = 0) {
        requestAnimationFrame(this.render.bind(this));
        const dt = time - (this.lastFrameTime || 0);
        const df = dt * 60 / 1000;
        this.lastFrameTime = time;

        // move camera
        const newCamPos = new Vec3(world.player.x, world.player.y, 0);
        this.camPos.lerp(newCamPos, 1 - Math.pow(1 - this.panSpeed, df));

        this.camera.position.set(this.camPos.x-0.08, this.camPos.y-1, 5);
        this.camera.lookAt(this.camPos.x, this.camPos.y, 0.5);

        // move player light
        this.playerLight.position.set(this.camPos.x, this.camPos.y, this.playerLight.position.z);

        // move environment pieces
        this.world.map.movingCells.forEach(c => {
            switch(c.type) {
                case 'door':
                    if(c.currentDoorRotation < c.desiredDoorRotation) {
                        c.currentDoorRotation = Math.min(c.currentDoorRotation + this.doorOpenSpeed * df, c.desiredDoorRotation);
                        c.doorObject.setRotationFromAxisAngle(new Vec3(0, 0, 1), Math.PI*0.5*c.currentDoorRotation);
                    } else if(c.currentDoorRotation > c.desiredDoorRotation) {
                        c.currentDoorRotation = Math.max(c.currentDoorRotation - this.doorOpenSpeed * df, c.desiredDoorRotation);
                        c.doorObject.setRotationFromAxisAngle(new Vec3(0, 0, 1), Math.PI*0.5*c.currentDoorRotation);
                    }
                    break;
            }
        });

        this.renderer.render(this.scene, this.camera);
    }

    loadObject(name, position, rot = 0, options = {cast: false, doorFor: null}) {
        var loader = new THREE.GLTFLoader();

        loader.load(`objects/${name}.glb`, gltf => {
            this.scene.add(gltf.scene);
            gltf.scene.rotateZ(rot * Math.PI/2.0);

            function setShadowProps(thing) {
                if(thing.userData.cast > 0) {
                    thing.castShadow = true;
                    // thing.visible = false;
                }
                thing.receiveShadow = true;
                thing.children.forEach(setShadowProps);
            }
            setShadowProps(gltf.scene);

            gltf.scene.position.x = position.x;
            gltf.scene.position.y = position.y;
            gltf.scene.position.z = position.z;

            if(options.doorFor) {
                options.doorFor.doorObject = gltf.scene;
            }
        });
    }

    loadLevelObjects() {
        this.world.map.forEachCell(c => {
            if(c.isWall()) {
                // build the walls in this cell
                const wallProfile = c.getWallProfile();
                switch(wallProfile) {
                    case 'eeee':
                        this.loadObject('walls4', new THREE.Vector3(c.x, c.y, 0), randInt(0, 4), {cast: true});
                        break;
                    case 'weee':
                        this.loadObject('walls3', new THREE.Vector3(c.x, c.y, 0), 0, {cast: true});
                        break;
                    case 'ewee':
                        this.loadObject('walls3', new THREE.Vector3(c.x, c.y, 0), 1, {cast: true});
                        break;
                    case 'eewe':
                        this.loadObject('walls3', new THREE.Vector3(c.x, c.y, 0), 2, {cast: true});
                        break;
                    case 'eeew':
                        this.loadObject('walls3', new THREE.Vector3(c.x, c.y, 0), 3, {cast: true});
                        break;
                    case 'wewe':
                        this.loadObject('walls2a', new THREE.Vector3(c.x, c.y, 0), randInt(0, 1) * 2, {cast: true});
                        break;
                    case 'ewew':
                        this.loadObject('walls2a', new THREE.Vector3(c.x, c.y, 0), randInt(0, 1) * 2 + 1, {cast: true});
                        break;
                    case 'wwee':
                        this.loadObject('walls2b', new THREE.Vector3(c.x, c.y, 0), 0, {cast: true});
                        break;
                    case 'ewwe':
                        this.loadObject('walls2b', new THREE.Vector3(c.x, c.y, 0), 1, {cast: true});
                        break;
                    case 'eeww':
                        this.loadObject('walls2b', new THREE.Vector3(c.x, c.y, 0), 2, {cast: true});
                        break;
                    case 'weew':
                        this.loadObject('walls2b', new THREE.Vector3(c.x, c.y, 0), 3, {cast: true});
                        break;
                    case 'ewww':
                        this.loadObject('walls1', new THREE.Vector3(c.x, c.y, 0), 0, {cast: true});
                        break;
                    case 'weww':
                        this.loadObject('walls1', new THREE.Vector3(c.x, c.y, 0), 1, {cast: true});
                        break;
                    case 'wwew':
                        this.loadObject('walls1', new THREE.Vector3(c.x, c.y, 0), 2, {cast: true});
                        break;
                    case 'wwwe':
                        this.loadObject('walls1', new THREE.Vector3(c.x, c.y, 0), 3, {cast: true});
                        break;
                }
                // add in missing corners
                [
                    !c.cellNE().isWall() && c.cellN().isWall() && c.cellE().isWall(),
                    !c.cellNW().isWall() && c.cellN().isWall() && c.cellW().isWall(),
                    !c.cellSW().isWall() && c.cellS().isWall() && c.cellW().isWall(),
                    !c.cellSE().isWall() && c.cellS().isWall() && c.cellE().isWall(),
                ].forEach((needsCorner, i) => {
                    if(needsCorner) {
                        const l = randChoice(['a', 'b', 'c']);
                        this.loadObject('walls0'+l, new THREE.Vector3(c.x, c.y, 0), i, {cast: true});
                    }
                });
            }

            if(c.hasFloor()) {
                // add floor
                const l = randChoice(['a', 'b', 'c']);
                this.loadObject('floor0'+l, new THREE.Vector3(c.x, c.y, 0), randInt(0, 4));
            }

            if(c.type == 'water') {
                // add floor
                const l = randChoice(['a', 'b', 'c']);
                this.loadObject('floor0'+l, new THREE.Vector3(c.x, c.y, -0.5), randInt(0, 4));
                // add water surface
                this.loadObject('water', new THREE.Vector3(c.x, c.y, 0), 0);
                // add below water walls
                [
                    c.cellE().type != 'water',
                    c.cellN().type != 'water',
                    c.cellW().type != 'water',
                    c.cellS().type != 'water',
                ].forEach((needsWall, i) => {
                    if(needsWall) {
                        this.loadObject('belowWaterWall', new THREE.Vector3(c.x, c.y, 0), i, {cast: true});
                    }
                });
            }

            if(c.type == 'stairs') {
                let r = 0;
                if(!c.cellE().isWall()) {
                    r = 2;
                } else if(!c.cellN().isWall()) {
                    r = 3;
                } else if(!c.cellW().isWall()) {
                    r = 0;
                } else if(!c.cellS().isWall()) {
                    r = 1;
                }
                this.loadObject('stairs', new THREE.Vector3(c.x, c.y, 0), r, {cast: true});
            }

            if(c.type == 'door') {
                this.loadObject('doorFrame', new THREE.Vector3(c.x, c.y, 0), 2+c.cellE().isWall(), {cast: true});
                if(c.cellE().isWall()) {
                    c.desiredDoorRotation = c.currentDoorRotation = 3;
                    this.loadObject('door',
                        new THREE.Vector3(c.x-0.25, c.y, 0),
                        c.currentDoorRotation,
                        {
                            cast: true,
                            doorFor: c,
                        }
                    );
                }else{
                    c.desiredDoorRotation = c.currentDoorRotation = 2;
                    this.loadObject('door',
                        new THREE.Vector3(c.x, c.y+0.25, 0),
                        c.currentDoorRotation,
                        {
                            cast: true,
                            doorFor: c,
                        }
                    );
                }
            }
        });
    }
}

var world = new World();
var view = new WorldView(world);
view.loadLevelObjects();
view.render();


window.addEventListener('keypress', e => {
    switch(e.code) {
        case 'KeyW':
        case 'ArrowUp':
            world.player.tryToMove(0, 1);
            break;
        case 'KeyS':
        case 'ArrowDown':
            world.player.tryToMove(0, -1);
            break;
        case 'KeyD':
        case 'ArrowRight':
            world.player.tryToMove(1, 0);
            break;
        case 'KeyA':
        case 'ArrowLeft':
            world.player.tryToMove(-1, 0);
            break;
    }
});
