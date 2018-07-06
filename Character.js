class Character{
    constructor(world) {
        this.world = world;
        this.mesh = null;

        this.x = 1;
        this.y = 1;
        this.type = '';
        this.icon = '?';
        this.color = 0xffffff;

        // stats
        this.dead = false;
        this.level = 0;
        this.exp = 0;
        this.maxHp = 5;
        this.currentHp = 5;

        this.strength = 0;
        this.soul = 0;
        this.precision = 0;
        this.voice = 0;

        // movement
        this.flying = false;
        this.aquaticOnly = false;

        // gear
        this.unarmedAttack;
        this.weapon;
        this.offHandItem;
        this.helmet;
        this.armor;
        this.boots;

        // spells
        this.spells = [];

        // inventory
        this.inventory = [];

        // view and animation properties
        this.attackOffset = new THREE.Vector2(0, 0); // an offset that gets added to your position to animate attacks
    }

    getCell() {
        return this.world.map.at(this.x, this.y);
    }

    getScores() {
        return {
            str: this.strength,
            sol: this.soul,
            pre: this.precision,
            voi: this.voice,
            lvl: this.level,
        };
    }

    getTotalAc() {
        // TODO: account for armor/dex
        return 5;
    }

    canMoveIntoCell(c) {
        return !c.isWall() &&
            (!c.isPit() || this.flying) &&
            (c.type == 'water' || !this.aquaticOnly) &&
            !c.occupiedBy();
    }

    canMove(dx, dy, typeExcludes = []) {
        const newCell = this.world.map.at(this.x + dx, this.y + dy);
        return this.canMoveIntoCell(newCell) &&
            typeExcludes.indexOf(newCell.type) == -1;
    }

    getMoveChoices(typeExcludes = []) {
        return [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
        ].filter(([dx, dy]) => this.canMove(dx, dy, typeExcludes));
    }

    die() {
        this.world.log(`${this.getLogName()} dies!`);
        this.dropLoot();
        this.x = -1;
        this.y = -1;
        this.dead = true;
    }

    dropLoot() {
        // TODO
    }

    takeDamage(amount) {
        this.currentHp -= amount;
        if(this.currentHp <= 0) {
            this.die();
        }
    }

    move(dx, dy) {
        // assumes we checked canMove first
        const oldCell = this.world.map.at(this.x, this.y);
        const newCell = this.world.map.at(this.x + dx, this.y + dy);
        this.x = newCell.x;
        this.y = newCell.y;

        // set door states
        if(oldCell.type == 'door') {
            oldCell.setDoorOpen(false);
        }
        if(newCell.type == 'door') {
            newCell.setDoorOpen(true);
        }
    }

    inMeleeRange(enemy) {
        return this.getCell().adjacentTo(enemy.getCell());
    }

    meleeAttack(enemy) {
        // add attackOffset
        this.attackOffset.x += (enemy.x - this.x) * 0.25;
        this.attackOffset.y += (enemy.y - this.y) * 0.25;

        // do attack logic
        const weapon = this.weapon;
        if(weapon && weapon.melee) {
            // check hit
            const hitRoll = this.weapon.rollToHit(this.getScores());
            let damage = 0;
            if(hitRoll == 'crit') {
                let damage = this.weapon.rollCritDamage(this.getScores());
                if(this.isPlayer()) {
                    this.world.log(`You critically hit ${enemy.getLogName()} with your ${weapon.typeName} for ${damage} damage.`)
                }else{
                    this.world.log(`${this.getLogName()} critically hits you with its ${weapon.typeName} for ${damage} damage.`)
                }
                enemy.takeDamage(damage);
                return;
            }

            if(hitRoll > enemy.getTotalAc()) {
                let damage = this.weapon.rollDamage(this.getScores());
                if(this.isPlayer()) {
                    this.world.log(`You hit ${enemy.getLogName()} with your ${weapon.typeName} for ${damage} damage.`)
                }else{
                    this.world.log(`${this.getLogName()} hits you with its ${weapon.typeName} for ${damage} damage.`)
                }
                enemy.takeDamage(damage);
                return;
            }

            // miss
            if(this.isPlayer()) {
                this.world.log(`You miss ${enemy.getLogName()}.`)
            }else{
                this.world.log(`${this.getLogName()} misses you.`)
            }
            return;

        }else{
            // TODO: unarmed attack
        }
    }

    getMoveDirectionTowards(x, y) {
        // runs A* search to find which way we should move to go toward (x, y)
        // we only care about the result of the last step,
        //  so start from (x, y) and search towards (this.x, this.y)
        const goal = this.getCell();
        function dist(a, b) {
            return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        }
        const start = this.world.map.at(x, y);
        start._movesFromStart = 0;

        const closed = {};
        const fringe = new MinHeap();
        fringe.push(this.world.map.at(x, y));

        while(fringe.length) {
            const current = fringe.pop();
            if(closed[current.x + " " + current.y]) continue;
            closed[current.x + " " + current.y] = true;

            if(dist(current, goal) == 1) {
                // this is the cell we want to move to
                return [current.x - goal.x, current.y - goal.y];
            }

            // get adjacent cells
            let cellsToAdd = [
                current.cellN(),
                current.cellS(),
                current.cellE(),
                current.cellW(),
            ].filter(c => this.canMoveIntoCell(c));
            // randomize the order so pathing breaks ties randomly
            cellsToAdd = _.shuffle(cellsToAdd);
            // add to fringe
            cellsToAdd.forEach(c => {
                c._movesFromStart = current._movesFromStart + 1;
                fringe.push(c, c._movesFromStart + dist(c, goal));
            });
        }

        // we didn't find a solution
        return [0, 0];
    }
}
