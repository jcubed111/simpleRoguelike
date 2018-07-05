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
            // can't move, don't do anything
            return false;
        }

        // if we moved, set door states
        if(oldCell.type == 'door') {
            oldCell.setDoorOpen(false);
        }
        if(newCell.type == 'door') {
            newCell.setDoorOpen(true);
        }

        // also update cell visibility
        this.world.updateCellVisibility();
    }
}

class World{
    constructor() {
        // this.map = new Map(15, 15, `
        //     1 1 1 1 1 1 1 1 1 1 1 1 1 1 1
        //     1 0 0 0 1 1 1 s 1 1 0 0 0 1 1
        //     1 0 1 0 0 0 0 0 0 0 0 1 1 1 1
        //     1 0 0 1 1 1 d 1 1 1 0 0 0 1 1
        //     1 1 0 1 1 0 0 0 1 1 0 1 0 1 1
        //     1 1 0 1 1 0 0 0 1 1 0 0 0 1 1
        //     1 0 0 0 d 0 w w 1 1 1 0 1 1 1
        //     1 s 1 0 1 0 w 0 1 1 1 0 1 1 1
        //     1 1 1 0 1 1 1 d 1 1 1 d 1 1 1
        //     1 0 0 0 1 1 1 0 1 0 0 0 0 0 1
        //     1 0 1 1 1 1 1 0 1 0 w w w 0 1
        //     1 0 1 1 0 0 0 0 1 0 w w w 0 1
        //     1 0 0 0 0 1 1 0 d 0 0 0 0 0 1
        //     1 1 1 1 1 1 1 1 1 1 1 0 0 0 1
        //     1 1 1 1 1 1 1 1 1 1 1 1 1 1 1
        // `);

        this.map = new Map(35, 35);

        this.player = new Player(this, 1, 7);

        const startingCell = randChoice(this.map.filterCells(c => c.type == 'floor'));
        this.player.x = startingCell.x;
        this.player.y = startingCell.y;

        this.updateCellVisibility();
    }

    updateCellVisibility() {
        this.map.forEachCell(c => {
            c.wallWVisibleToPlayer =
            c.wallSVisibleToPlayer =
            c.wallEVisibleToPlayer =
            c.wallNVisibleToPlayer = false;
        });

        const tolerance = 0.05; // amount you can bend your vision around corners. ~= 3deg

        const px = this.player.x;
        const py = this.player.y;
        const searchedInterval = new IntervalTree;
        for(let i=0; i < visibilityEdgeList.length; i++) {
            const edge = visibilityEdgeList[i];
            if(!this.map.contains(px + edge.dx, py + edge.dy)) continue;
            const cell = this.map.at(px + edge.dx, py + edge.dy);
            if(!searchedInterval.contains(edge.minAngle-tolerance, edge.maxAngle+tolerance)) {
                cell.setWallVisible(edge.side);

                if(cell.blocksLOS()) {
                    searchedInterval.insert(edge.minAngle, edge.maxAngle);
                    if(searchedInterval.contains(-Math.PI, Math.PI)) {
                        // all view is obscured
                        break;
                    }
                }
            }
        }

        // the player can obviously see the cell they're in
        const playerCell = this.map.at(this.player.x, this.player.y);
        playerCell.setWallVisible('n');
        playerCell.setWallVisible('s');
        playerCell.setWallVisible('e');
        playerCell.setWallVisible('w');

        // hack to make doors show their adjacent walls
        this.map.forEachCell(c => {
            if(c.type == 'door' && c.doorOpen == false && (
                c.wallWVisibleToPlayer ||
                c.wallSVisibleToPlayer ||
                c.wallEVisibleToPlayer ||
                c.wallNVisibleToPlayer
            )) {
                // find the door walls the player might be able to see and make them visible
                if(c.y >= py && c.cellN().isWall()) { c.cellN().setWallVisible('s'); }
                if(c.y <= py && c.cellS().isWall()) { c.cellS().setWallVisible('n'); }
                if(c.x >= px && c.cellE().isWall()) { c.cellE().setWallVisible('w'); }
                if(c.x <= px && c.cellW().isWall()) { c.cellW().setWallVisible('e'); }
            }
        });

        this.map.forEachCell(c => {
            c.visibleToPlayer =
                c.wallWVisibleToPlayer ||
                c.wallSVisibleToPlayer ||
                c.wallEVisibleToPlayer ||
                c.wallNVisibleToPlayer;
        });
    }
}

class WorldView {
    constructor(world) {
        this.panSpeed = 0.09; // how fast the camera moves, (0, 1]. 1 = instant
        this.doorOpenSpeed = 0.08; // how fast doors open, (0, 1]. 1 = instant
        this.hardcoreMode = false; // whether to only light the dungeon you can see
        this.cameraZ = 5;

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

        /* player light */
        this.playerLight = new THREE.PointLight(0xff8811, this.hardcoreMode ? 3.0 : 2.5, 7, 0.8);
        this.playerLight.position.set(0, 0, 0.8);
        this.playerLight.castShadow = true;
        this.playerLight.shadow.camera.far = this.playerLight.distance;
        this.playerLight.shadow.camera.near = 0.1;
        this.scene.add(this.playerLight);

        /* background lighting */
        this.keyLight = new THREE.DirectionalLight(0xffffcc, 0.35);
        this.keyLight.position.set(-7, -10, 10);
        if(!this.hardcoreMode) this.scene.add(this.keyLight);

        this.fillLight = new THREE.AmbientLight(0x777777ff, 0.25);
        if(!this.hardcoreMode) this.scene.add(this.fillLight);

        /* environment lighting */
        // TODO: these are slooooooow, so hide them when they're off screen
        let waterLight = this.waterLight = new THREE.RectAreaLight(0x00ffaa, 1.5, 2, 3);
        waterLight.position.set(6, 8.5, 0.9);
        waterLight.setRotationFromAxisAngle(new Vec3(1, 0, 0), Math.PI); // point down
        this.scene.add(waterLight);

        let waterLight2 = this.waterLight2 = new THREE.RectAreaLight(0x00ffaa, 1.5, 4, 3);
        waterLight2.position.set(11, 3.5, 0.9);
        waterLight2.setRotationFromAxisAngle(new Vec3(1, 0, 0), Math.PI); // point down
        this.scene.add(waterLight2);

        /* player sprite */
        var loader = new THREE.FontLoader();

        loader.load('Inconsolata_Medium.json', font => {
            var geometry = new THREE.TextGeometry('@', {
                font: font,
                size: 0.8,
                height: 0.1,
                curveSegments: 12,
                bevelEnabled: false,
                bevelThickness: 0.05,
                bevelSize: 0.05,
                bevelSegments: 2
            });
            var material = new THREE.MeshBasicMaterial( { color: 0xdddddd } );
            this.player = new THREE.Mesh( geometry, material );
            this.player.scale.y = 0.7;
            this.player.scale.x = 1.0;
            this.player.castShadow = true;
            this.scene.add( this.player );
        } );
    }

    screenCoordToWorldCoord(x, y) {
        var pos = new Vec3(x, y, 0.5);
        pos.unproject(this.camera);
        var ray = pos.sub(this.camera.position);
        var final = this.camera.position.clone().addScaledVector(ray, -this.camera.position.z / ray.z);
        return final;
    }

    render(time = 0) {
        requestAnimationFrame(this.render.bind(this));
        const dt = time - (this.lastFrameTime || 0);
        const df = dt * 60 / 1000;
        this.lastFrameTime = time;

        // move camera
        const newCamPos = new Vec3(this.world.player.x, this.world.player.y, 0);
        this.camPos.lerp(newCamPos, 1 - Math.pow(1 - this.panSpeed, df));

        this.camera.position.set(this.camPos.x-0.08, this.camPos.y-1, this.cameraZ);
        this.camera.lookAt(this.camPos.x, this.camPos.y, 0.5);

        // move player light
        this.playerLight.position.set(this.camPos.x, this.camPos.y, this.playerLight.position.z);
        if(this.player) this.player.position.set(this.camPos.x-0.3, this.camPos.y-0.35, 0.2);
        if(this.player) this.player.position.set(this.world.player.x-0.3, this.world.player.y-0.35, 0.2);

        // move environment pieces
        this.world.map.movingCells.forEach(c => {
            switch(c.type) {
                case 'door':
                    if(c.currentDoorRotation < c.desiredDoorRotation) {
                        c.currentDoorRotation = Math.min(c.currentDoorRotation + this.doorOpenSpeed * df, c.desiredDoorRotation);
                    } else if(c.currentDoorRotation > c.desiredDoorRotation) {
                        c.currentDoorRotation = Math.max(c.currentDoorRotation - this.doorOpenSpeed * df, c.desiredDoorRotation);
                    } else {
                        break;
                    }
                    // move the door meshes
                    c.objects.door.forEach(o => o.setRotationFromAxisAngle(new Vec3(0, 0, 1), Math.PI*0.5*c.currentDoorRotation));
                    break;
            }
        });

        // update the camera matrices or screenCoordToWorldCoord flips out
        this.camera.updateMatrix();
        this.camera.updateMatrixWorld();

        // find bounds of camera view
        let bounds = [
            this.screenCoordToWorldCoord(1, 1),
            this.screenCoordToWorldCoord(-1, 1),
            this.screenCoordToWorldCoord(-1, -1),
            this.screenCoordToWorldCoord(1, -1)
        ];
        const xmin = Math.round(Math.min(...bounds.map(b => b.x)));
        const xmax = Math.round(Math.max(...bounds.map(b => b.x)));
        const ymin = Math.round(Math.min(...bounds.map(b => b.y)));
        const ymax = Math.round(Math.max(...bounds.map(b => b.y)));

        // hide cells that aren't in bounds
        this.world.map.forEachCell(c => {
            c.objectGroup.visible = c.x >= xmin && c.x <= xmax && c.y >= ymin && c.y <= ymax;
        });

        // render
        this.renderer.render(this.scene, this.camera);
    }

    loadObject(name, position, rot = 0, cell = null, cellPartNames = '') {
        var loader = new THREE.GLTFLoader();

        loader.load(`objects/${name}.glb`, gltf => {
            const object = gltf.scene;
            object.rotateZ(rot * Math.PI/2.0);

            function setShadowProps(thing) {
                if(thing.userData.cast > 0) {
                    thing.castShadow = true;
                }
                thing.receiveShadow = true;
                thing.children.forEach(setShadowProps);
            }
            setShadowProps(object);

            object.position.x = position.x;
            object.position.y = position.y;
            object.position.z = position.z;

            if(cell) {
                object.visible = false;
                cellPartNames.split(' ').forEach(n => {
                    cell.objects[n].push(object);
                });
            }else{
                // if we're part of a cell, we'll get added to the scene through the cell's group
                // otherwise, add manually
                this.scene.add(object);
            }
        });
    }

    loadLevelObjects() {
        this.world.map.forEachCell(c => {
            this.scene.add(c.objectGroup);

            if(c.isWall()) {
                // build the walls in this cell
                const wallProfile = c.getWallProfile();
                switch(wallProfile) {
                    case 'eeee':
                        this.loadObject('walls4', new THREE.Vector3(c.x, c.y, 0), randInt(0, 4), c, 'wallE wallN wallW wallS');
                        break;
                    case 'weee':
                        this.loadObject('walls3', new THREE.Vector3(c.x, c.y, 0), 0, c, 'wallN wallW wallS');
                        break;
                    case 'ewee':
                        this.loadObject('walls3', new THREE.Vector3(c.x, c.y, 0), 1, c, 'wallE wallW wallS');
                        break;
                    case 'eewe':
                        this.loadObject('walls3', new THREE.Vector3(c.x, c.y, 0), 2, c, 'wallE wallN wallS');
                        break;
                    case 'eeew':
                        this.loadObject('walls3', new THREE.Vector3(c.x, c.y, 0), 3, c, 'wallE wallN wallW');
                        break;
                    case 'wewe':
                        this.loadObject('walls2a', new THREE.Vector3(c.x, c.y, 0), randInt(0, 1) * 2, c, 'wallN wallS');
                        break;
                    case 'ewew':
                        this.loadObject('walls2a', new THREE.Vector3(c.x, c.y, 0), randInt(0, 1) * 2 + 1, c, 'wallE wallW');
                        break;
                    case 'wwee':
                        this.loadObject('walls2b', new THREE.Vector3(c.x, c.y, 0), 0, c, 'wallW wallS');
                        break;
                    case 'ewwe':
                        this.loadObject('walls2b', new THREE.Vector3(c.x, c.y, 0), 1, c, 'wallE wallS');
                        break;
                    case 'eeww':
                        this.loadObject('walls2b', new THREE.Vector3(c.x, c.y, 0), 2, c, 'wallE wallN');
                        break;
                    case 'weew':
                        this.loadObject('walls2b', new THREE.Vector3(c.x, c.y, 0), 3, c, 'wallN wallW');
                        break;
                    case 'ewww':
                        this.loadObject('walls1', new THREE.Vector3(c.x, c.y, 0), 0, c, 'wallE');
                        break;
                    case 'weww':
                        this.loadObject('walls1', new THREE.Vector3(c.x, c.y, 0), 1, c, 'wallN');
                        break;
                    case 'wwew':
                        this.loadObject('walls1', new THREE.Vector3(c.x, c.y, 0), 2, c, 'wallW');
                        break;
                    case 'wwwe':
                        this.loadObject('walls1', new THREE.Vector3(c.x, c.y, 0), 3, c, 'wallS');
                        break;
                }
                // add in missing corners
                [
                    !c.cellNE().isWall() && c.cellN().isWall() && c.cellE().isWall(),
                    !c.cellNW().isWall() && c.cellN().isWall() && c.cellW().isWall(),
                    !c.cellSW().isWall() && c.cellS().isWall() && c.cellW().isWall(),
                    !c.cellSE().isWall() && c.cellS().isWall() && c.cellE().isWall(),
                ].forEach((needsCorner, i) => {
                    const cornerNames = ['cornerNE', 'cornerNW', 'cornerSW', 'cornerSE'];
                    if(needsCorner) {
                        const l = randChoice(['a', 'b', 'c']);
                        this.loadObject('walls0'+l, new THREE.Vector3(c.x, c.y, 0), i, c, cornerNames[i]);
                    }
                });
            }

            if(c.hasFloor()) {
                // add floor
                const l = randChoice(['a', 'b', 'c']);
                this.loadObject('floor0'+l, new THREE.Vector3(c.x, c.y, 0), randInt(0, 4), c, 'main');
            }

            if(c.type == 'water') {
                // add floor
                const l = randChoice(['a', 'b', 'c']);
                this.loadObject('floor0'+l, new THREE.Vector3(c.x, c.y, -0.5), randInt(0, 4), c, 'main');
                // add water surface
                this.loadObject('water', new THREE.Vector3(c.x, c.y, -0.1), 0, c, 'main');
                // add below water walls
                [
                    c.cellE().type != 'water',
                    c.cellN().type != 'water',
                    c.cellW().type != 'water',
                    c.cellS().type != 'water',
                ].forEach((needsWall, i) => {
                    if(needsWall) {
                        this.loadObject('belowWaterWall', new THREE.Vector3(c.x, c.y, 0), i, c, 'main');
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
                this.loadObject('stairs', new THREE.Vector3(c.x, c.y, 0), r, c, 'main');
            }

            if(c.type == 'door') {
                this.loadObject('doorFrame', new THREE.Vector3(c.x, c.y, 0), 2+c.cellE().isWall(), c, 'main');

                let doorPos;
                if(c.cellE().isWall()) {
                    c.desiredDoorRotation = c.currentDoorRotation = 3;
                    doorPos = new THREE.Vector3(c.x-0.25, c.y, 0);
                }else{
                    c.desiredDoorRotation = c.currentDoorRotation = 2;
                    doorPos = new THREE.Vector3(c.x, c.y+0.25, 0);
                }

                this.loadObject('door',
                    doorPos,
                    c.currentDoorRotation,
                    c,
                    'door',
                );
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
