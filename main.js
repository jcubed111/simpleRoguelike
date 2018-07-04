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
    }

    isWall() {
        return this.type == 'wall';
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
        const newCell = this.world.map.at(this.x + dx, this.y + dy);
        if(!newCell.isWall()) {
            this.x += dx;
            this.y += dy;
            return true;
        }
    }
}

class World{
    constructor() {
        this.map = new Map(9, 9, `
            1 1 1 1 1 1 1 1 1
            1 0 0 0 1 1 1 0 1
            1 0 1 0 0 0 0 0 1
            1 0 0 1 1 1 d 1 1
            1 1 0 1 1 0 0 0 1
            1 1 0 1 1 0 0 0 1
            1 0 0 0 d 0 0 0 1
            1 0 1 1 1 0 0 0 1
            1 1 1 1 1 1 1 1 1
        `);

        this.player = new Player(this, 1, 1);
    }
}

class WorldView {
    constructor(world) {
        this.world = world;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
        this.camera.up.set(0, 0, 1);
        this.panSpeed = 0.09; // how fast the camera moves, (0, 1]. 1 = instant
        this.lastFrameTime = 0;

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.shadowMap.enabled = true;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // lighting
        var keyLight = new THREE.DirectionalLight(0xffffcc, 0.5);
        keyLight.position.set(-7, -10, 10);
        // keyLight.castShadow = true;
        this.scene.add(keyLight);

        var fillLight = new THREE.AmbientLight(0x777777ff, 0.5);
        this.scene.add(fillLight);

        this.playerLight = new THREE.PointLight(0xff8800, 2.0, 5);
        this.playerLight.position.set(0, 0, 0.9);
        this.playerLight.castShadow = true;
        this.playerLight.shadow.camera.far = this.playerLight.distance;
        this.playerLight.shadow.camera.near = 0.1;
        this.scene.add(this.playerLight);

        this.camPos = new Vec3(world.player.x, world.player.y, 0);
    }

    render(time = 0) {
        requestAnimationFrame(this.render.bind(this));
        const dt = time - (this.lastFrameTime || 0);
        this.lastFrameTime = time;

        // move camera
        const newCamPos = new Vec3(world.player.x, world.player.y, 0);
        this.camPos.lerp(newCamPos, 1 - Math.pow(1 - this.panSpeed, dt * 60 / 1000));

        this.camera.position.set(this.camPos.x-0.08, this.camPos.y-1, 5);
        this.camera.lookAt(this.camPos.x, this.camPos.y, 0.5);

        // move player light
        this.playerLight.position.set(this.camPos.x, this.camPos.y, this.playerLight.position.z);

        this.renderer.render(this.scene, this.camera);
    }

    loadObject(name, position, rot = 0, options = {cast: false}) {
        var loader = new THREE.GLTFLoader();

        loader.load(`objects/${name}.glb`, gltf => {
            this.scene.add(gltf.scene);
            gltf.scene.rotateZ(rot * Math.PI/2.0);

            function setShadowProps(thing) {
                thing.castShadow = options.cast;
                thing.receiveShadow = true;
                thing.children.forEach(setShadowProps);
            }
            setShadowProps(gltf.scene);

            gltf.scene.position.x = position.x;
            gltf.scene.position.y = position.y;
            gltf.scene.position.z = position.z;
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
            }else{
                // add floor
                const l = randChoice(['a', 'b', 'c']);
                this.loadObject('floor0'+l, new THREE.Vector3(c.x, c.y, 0), randInt(0, 4));
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
