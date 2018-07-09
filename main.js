/* THREE js hack to improve performance */
let before = THREE.Object3D.prototype.updateMatrixWorld;
THREE.Object3D.prototype.updateMatrixWorld = function(force) {
    if(!this.visible) return;
    before.call(this, force);
};

/*****/
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

function oneIn(n) {
    return Math.random()*n < 1;
}

function padded(t, minLength, padding = " ") {
    const toAdd = Math.max(0, minLength - t.length);
    return t + padding.repeat(toAdd);
}

function titleCase(s) {
    return s.replace(/( |^|\n|\t)[a-z]/g, m => m.toUpperCase());
}

async function delay(ms) {
    await new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

class World{
    constructor() {
        this.eventLog = [];

        // this.map = new Map(this, 15, 15, `
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

        this.map = new Map(this, 75, 75);

        this.player = new Player(this, 'orc', 'fighter');

        this.map.characters.push(this.player);

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
            const minAngle = Math.max(-Math.PI, edge.minAngle-tolerance);
            const maxAngle = Math.min(Math.PI, edge.maxAngle+tolerance);
            if(!searchedInterval.contains(minAngle, maxAngle)) {
                // this edge isn't being blocked right now
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

    async doAiTurns(delayTime = 0) {
        for(let i=0; i < this.map.characters.length; i++) {
            const enemy = this.map.characters[i];
            if(!enemy.isEnemy() || enemy.dead) continue;

            let delayAfterTurn = enemy.canSeePlayer(); // delay if we see enemy at start of it's turn
            enemy.takeAiTurn();
            delayAfterTurn = delayAfterTurn || enemy.canSeePlayer(); // also delay if we see enemy at end of it's turn

            if(delayAfterTurn && delayTime > 0) {
                await delay(delayTime);
            }
        }
    }

    log(text) {
        this.eventLog.push(text);
    }
}

class GameController{
    constructor(view) {
        this.view = view;
        const world = this.world = view.world;
        const el = this.el = this.view.renderer.domElement;

        /* listen for user input */
        window.addEventListener('keydown', e => this.keydown(e));
        el.addEventListener('contextmenu', e => this.click(e));
        el.addEventListener('click', e => this.click(e));
        document.getElementById('cellInfo').addEventListener('click', e => {
            this.view.hideCellInfo();
        });
    }

    keydown(e) {
        if(!world.player.myTurn) return;

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
            case 'Space':
                world.player.pass();
                break;
        }
    }

    click(e) {
        e.preventDefault();
        if(e.button == 2 || (e.button == 0 && e.shiftKey)) {
            const pos = this.view.mousePosToWorldCoord(e.clientX, e.clientY);
            this.view.showCellInfo(world.map.at(
                Math.round(pos.x),
                Math.round(pos.y)
            ));
        }else if(e.button == 0) {
            if(!world.player.myTurn) return;
            // TODO: take action base don click
        }
        return false;
    }
}

class WorldView {
    constructor(world) {
        this.panSpeed = 0.09; // how fast the camera moves, (0, 1]. 1 = instant
        this.doorOpenSpeed = 0.08; // how fast doors open, (0, 1]. 1 = instant
        this.hardcoreMode = false; // whether to only light the dungeon you can see
        this.cameraZ = 5;

        this.objectLoadCache = {};

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
        this.playerLight = new THREE.PointLight(0xff9933, this.hardcoreMode ? 4.0 : 2.0, 7, 0.8);
        this.playerLight.position.set(0, 0, 0.8);
        this.playerLight.castShadow = true;
        this.playerLight.shadow.camera.far = this.playerLight.distance;
        this.playerLight.shadow.camera.near = 0.1;
        this.scene.add(this.playerLight);

        /* background lighting */
        this.keyLight = new THREE.DirectionalLight(0xffffcc, 0.5);
        this.keyLight.position.set(-7, -10, 10);
        if(!this.hardcoreMode) this.scene.add(this.keyLight);

        this.fillLight = new THREE.AmbientLight(0x777777ff, 0.3);
        if(!this.hardcoreMode) this.scene.add(this.fillLight);

        /* environment lighting */
        this.dynamicLights = [
            new THREE.PointLight(0x000000, 0.0),
            new THREE.PointLight(0x000000, 0.0),
            new THREE.PointLight(0x000000, 0.0),
            new THREE.PointLight(0x000000, 0.0),
            new THREE.PointLight(0x000000, 0.0),
        ];
        this.dynamicLights.forEach(l => {
            this.scene.add(l);
            // l.castShadow = true;
            // l.shadow.camera.near = 0.01;
            // l.shadow.camera.far = 5.0;
        });

        /* get user input */
        this.controller = new GameController(this);
    }

    mousePosToWorldCoord(mx, my) {
        let width = window.innerWidth;
        let height = window.innerHeight;
        return this.screenCoordToWorldCoord(
            mx / width * 2 - 1,
            my / height * -2 + 1
        );
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

        // update dynamic cells
        let lightSpecs = [];
        this.world.map.dynamicCells.forEach(c => {
            if(c.type == 'door') {
                let needToMoveDoor = false;
                if(c.currentDoorRotation < c.desiredDoorRotation) {
                    c.currentDoorRotation = Math.min(c.currentDoorRotation + this.doorOpenSpeed * df, c.desiredDoorRotation);
                    needToMoveDoor = true;
                } else if(c.currentDoorRotation > c.desiredDoorRotation) {
                    c.currentDoorRotation = Math.max(c.currentDoorRotation - this.doorOpenSpeed * df, c.desiredDoorRotation);
                    needToMoveDoor = true;
                }

                // move the door meshes
                if(needToMoveDoor) {
                    c.objects.door.forEach(o => o.setRotationFromAxisAngle(new Vec3(0, 0, 1), Math.PI*0.5*c.currentDoorRotation));
                }
            }

            if(c.lightSpec) {
                lightSpecs.push(c.lightSpec);
            }
        });

        // move our dynamic lights around to match the closest light specs
        lightSpecs.sort((a, b) => a.dist2(this.world.player) - b.dist2(this.world.player));
        this.dynamicLights.forEach(l => l.visible = false);
        for(let i=0; i<lightSpecs.length && i<this.dynamicLights.length; i++) {
            lightSpecs[i].setLightProps(this.dynamicLights[i]);
            this.dynamicLights[i].visible = true;
        }

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
            c.objectGroup.visible = c.x >= xmin-1 && c.x <= xmax+1 && c.y >= ymin-1 && c.y <= ymax+1;
        });

        // show room lights if the room is in bounds
        this.world.map.rooms.forEach(room => {
            const hidden = room.x2 < xmin || room.y2 < ymin || room.x1 > xmax || room.y1 > ymax;
            if(room.light) {
                room.light.setVisible(!hidden);
            }
        });

        // move characters
        this.world.map.characters.forEach(character => {
            if(!character.mesh) return;
            const visibleToPlayer = !character.dead && character.getCell().visibleToPlayer;
            character.mesh.visible = visibleToPlayer;
            if(visibleToPlayer) {
                const offset = character.attackOffset;
                character.mesh.position.set(character.x-0.3 + offset.x, character.y-0.25 + offset.y, 0.2);
                offset.clampLength(0, offset.length() * Math.pow(0.8, df));
            }
        });

        // render
        this.renderer.render(this.scene, this.camera);
        this.renderHud();
    }

    renderHud() {
        const world = this.world;
        const player = world.player;

        /* hp bar */
        const filled = '%'.repeat(Math.max(0, player.currentHp));
        const empty = '.'.repeat(Math.max(0, player.maxHp - player.currentHp));

        const max = player.maxHp.toString();
        let current = player.currentHp.toString();
        while(current.length < max.length) current = " "+current;

        let t = `HP: (${current}/${max}) [${filled}${empty}]`;
        document.getElementById('hpView').innerText = t;

        /* log */
        t = '';
        const linesToDisplay = Math.min(5, world.eventLog.length);
        for(let i = 0; i < linesToDisplay; i++) {
            t += '<div class="row">';
            t += world.eventLog[world.eventLog.length - linesToDisplay + i];
            t += '</div>';
        }
        document.getElementById('logView').innerHTML = t;
    }

    showCellInfo(cell) {
        // open the cellInfo pane for cell
        const el = document.getElementById('cellInfo');
        el.classList.remove('hidden');

        let contents = [
            this.classify(cell.generateCharacterInfo()),
            this.classify(cell.generateItemInfo()),
            this.classify(cell.generateBaseInfo()),
        ].filter(c => c.length);

        function numLines(text) {
            const matches = text.match(/\n/g);
            if(matches) return matches.length+1;
            if(text.length) return 1;
            return 0;
        }

        function makeVertDecor(lLines, rLines=0) {
            const breaks = [];
            if(lLines) breaks.push(lLines + 1);
            if(rLines) breaks.push(rLines + 1);
            const len = Math.max(lLines, rLines) + 2;
            let result = (lLines ? '-+' : ' +') + (rLines ? '-' : ' ');
            for(let i=1; i<len; i++) {
                result += '\n';
                result += (lLines && lLines + 1 == i) ? '-' : ' ';
                result += (breaks.indexOf(i) != -1) ? '+' : '|';
                result += (rLines && rLines + 1 == i) ? '-' : ' ';
            }
            return result;
        }

        let sectionLengths = contents.map(numLines)
            .filter(l => l > 0)
            .map(l => Math.min(l, 35));
        sectionLengths.push(0, 0, 0, 0);
        sectionLengths.unshift(0);

        el.querySelectorAll(".vertDecor").forEach((el, i) => {
            const lLength = sectionLengths[i];
            const rLength = sectionLengths[i+1];
            el.innerHTML = makeVertDecor(lLength, rLength);
            el.classList.toggle('hidden', lLength + rLength == 0);
        });

        el.querySelectorAll('.contentArea').forEach((el, i) => {
            const c = contents[i];
            if(c) {
                el.innerHTML = contents[i];
            }
            el.parentElement.classList.toggle('hidden', !c);
        });
    }

    hideCellInfo() {
        document.getElementById('cellInfo').classList.add('hidden');
    }

    classify(text, wrapMark = 40, blockIndent = 0) {
        wrapMark -= blockIndent;
        const blockIndentPadding = " ".repeat(blockIndent);
        if(text == '') return blockIndentPadding;
        const classNames = {
            d: 'decoration',
            b: 'bold',
            t: 'title',
            n: 'number',
            r: 'regular',
            c: 'color', // format: %c{#123456}
        };
        return text.trim().split('\n').map(line => {
            let resultLength = 0;
            let result = blockIndentPadding + "<span class='regular'>";
            let indent = line.search(/[^ \-]/);
            for(let i=0; i < line.length; i++) {
                let l = line[i];
                switch(l) {
                    case '%':
                        const next = line[++i];
                        if(next == 'c') {
                            const color = line.substr(i).match(/\{(#[0-9a-fA-F]+)\}/)[1];
                            result += "</span><span class='"+classNames.c+"' style='color: "+color+";'>";
                            i += color.length + 2;
                        }else{
                            let className = classNames[next] || 'error';
                            result += "</span><span class='"+className+"'>";
                        }
                        break;
                    case ' ':
                        if(resultLength < wrapMark) result += l;
                        resultLength++;
                        break;
                    default:
                        let part = '';
                        let j;
                        for(j=i; j < line.length; j++) {
                            if(line[j] == ' ' || line[j] == '%') break;
                            if(line[j] == '\\') j++;
                            part += line[j];
                        }
                        i = j - 1;

                        while(resultLength + part.length > wrapMark) {
                            // wrap
                            while(part.length > wrapMark - indent) {
                                if(resultLength > indent) {
                                    result += '\n' + blockIndentPadding;
                                    result += " ".repeat(indent);
                                }
                                result += part.substr(0, wrapMark - indent);
                                resultLength = wrapMark;
                                part = part.substr(wrapMark - indent);
                            }
                            resultLength = indent;
                            result += '\n' + blockIndentPadding;
                            result += " ".repeat(indent);
                        }
                        result += part;
                        resultLength += part.length;
                        break;
                }
            }
            return result + "</span>";
        }).join('\n');
    }

    async loadObjectToCache(name) {
        if(!this.objectLoadCache[name]) {
            // load for first time
            const loader = new THREE.GLTFLoader();
            await new Promise(resolve => {
                loader.load(`objects/${name}.glb`, gltf => {
                    this.objectLoadCache[name] = gltf.scene;
                    resolve();
                });
            });
        }
    }

    async loadObject(name, position, rot = 0, cell = null, cellPartNames = '') {
        if(!this.objectLoadCache[name]) {
            console.warn('Object loading cache miss on ' + name);
            await this.loadObjectToCache(name);
        }

        const object = this.objectLoadCache[name].clone();

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
    }

    loadSprite(thing, icon, color = 0xdddddd) {
        // icon is the character used to represent thing thing. eg: @
        var loader = new THREE.FontLoader();

        loader.load('Inconsolata_Medium.json', font => {
            var geometry = new THREE.TextGeometry(icon, {
                font: font,
                size: 0.8,
                height: 0.1,
                curveSegments: 12,
                bevelEnabled: false,
                bevelThickness: 0.05,
                bevelSize: 0.05,
                bevelSegments: 2
            });
            var material = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.5,
            });
            thing.mesh = new THREE.Mesh(geometry, material);
            thing.mesh.scale.y = 0.7;
            thing.mesh.scale.x = 1.0;
            thing.mesh.castShadow = true;
            this.scene.add(thing.mesh);
        } );
    }

    loadLevelObjects() {
        // load cells
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
                        this.loadObject('walls1', new THREE.Vector3(c.x, c.y, 0), 1, c, 'wallN');
                        this.loadObject('walls1', new THREE.Vector3(c.x, c.y, 0), 3, c, 'wallS');
                        // this.loadObject('walls2a', new THREE.Vector3(c.x, c.y, 0), randInt(0, 1) * 2, c, 'wallN wallS');
                        break;
                    case 'ewew':
                        this.loadObject('walls1', new THREE.Vector3(c.x, c.y, 0), 0, c, 'wallE');
                        this.loadObject('walls1', new THREE.Vector3(c.x, c.y, 0), 2, c, 'wallW');
                        // this.loadObject('walls2a', new THREE.Vector3(c.x, c.y, 0), randInt(0, 1) * 2 + 1, c, 'wallE wallW');
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

            if(c.type == 'water' || c.type == 'pit') {
                // add below ground walls
                [
                    c.cellE().type != 'water' && c.cellE().type != 'pit',
                    c.cellN().type != 'water' && c.cellN().type != 'pit',
                    c.cellW().type != 'water' && c.cellW().type != 'pit',
                    c.cellS().type != 'water' && c.cellS().type != 'pit',
                ].forEach((needsWall, i) => {
                    if(needsWall) {
                        this.loadObject('belowWaterWall', new THREE.Vector3(c.x, c.y, 0), i, c, 'main');
                    }
                });
            }

            if(c.type == 'water') {
                // add floor
                const l = randChoice(['a', 'b', 'c']);
                this.loadObject('floor0'+l, new THREE.Vector3(c.x, c.y, -0.5), randInt(0, 4), c, 'main');
                // add water surface
                this.loadObject('water', new THREE.Vector3(c.x, c.y, -0.1), 0, c, 'main');
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

            // decoration
            if(c.wallDecorE != 'none') {
                this.loadObject(c.wallDecorE, new THREE.Vector3(c.x, c.y, 0), 0, c, 'wallE');
            }
            if(c.wallDecorN != 'none') {
                this.loadObject(c.wallDecorN, new THREE.Vector3(c.x, c.y, 0), 1, c, 'wallN');
            }
            if(c.wallDecorW != 'none') {
                this.loadObject(c.wallDecorW, new THREE.Vector3(c.x, c.y, 0), 2, c, 'wallW');
            }
            if(c.wallDecorS != 'none') {
                this.loadObject(c.wallDecorS, new THREE.Vector3(c.x, c.y, 0), 3, c, 'wallS');
            }
        });

        // add room lights to scene
        this.world.map.rooms.forEach(room => {
            if(room.light) {
                this.scene.add(room.light.light);
            }
        });

        // add chracter sprites
        this.world.map.characters.forEach(character => {
            this.loadSprite(character, character.icon, character.color);
        });
    }
}

var world = new World();
var view = new WorldView(world);

async function start() {
    await view.loadObjectToCache('belowWaterWall');
    await view.loadObjectToCache('floor0a');
    await view.loadObjectToCache('floor0b');
    await view.loadObjectToCache('floor0c');
    await view.loadObjectToCache('stairs');
    await view.loadObjectToCache('walls0a');
    await view.loadObjectToCache('walls0b');
    await view.loadObjectToCache('walls0c');
    await view.loadObjectToCache('walls1');
    await view.loadObjectToCache('walls2a');
    await view.loadObjectToCache('walls2b');
    await view.loadObjectToCache('walls3');
    await view.loadObjectToCache('walls4');
    await view.loadObjectToCache('doorFrame');
    await view.loadObjectToCache('door');
    await view.loadObjectToCache('water');
    await view.loadObjectToCache('torch');
    await view.loadObjectToCache('mushroomGrove');

    view.loadLevelObjects();
    view.render();
}
start();


