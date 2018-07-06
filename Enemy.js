class Enemy extends Character{
    constructor(world, level) {
        super(world);
        this.type = '???';
        this.level = level;

        this.aiData = {
            lastPlayerCell: null,
            huntingPlayer: false,
        };
    }

    isEnemy() { return true; }
    isPlayer() { return false; }

    canSeePlayer() {
        // If the player can see me, I can see them
        return this.getCell().visibleToPlayer;
    }

    updatePlayerLocationKnowledge() {
        if(this.canSeePlayer()) {
            this.aiData.lastPlayerCell = this.world.player.getCell();
        }
    }

    takeAiTurn() {
        console.error("Must override Enemy.takeAiTurn method.");
    }

    getLogName() {
        return "the " + this.type;
    }
}

class BasicMeleeEnemy extends Enemy{
    takeAiTurn() {
        this.updatePlayerLocationKnowledge();

        if(this.canSeePlayer()) {
            this.aiData.huntingPlayer = true;
        }

        if(this.aiData.huntingPlayer) {
            if(this.inMeleeRange(this.world.player)) {
                // attack!
                this.meleeAttack(this.world.player);
            }else{
                // move towards last known player location
                return this.aiMoveToward(this.aiData.lastPlayerCell);
            }
        }else{
            return this.aiMoveWander();
        }
    }

    aiMoveToward(cell) {
        const [dx, dy] = this.getMoveDirectionTowards(cell.x, cell.y);
        if(this.canMove(dx, dy)) {
            this.move(dx, dy);
        }else{
            this.move(0, 0);
        }
    }

    aiMoveWander() {
        const choices = this.getMoveChoices(['door']);
        if(choices.length == 0) return;
        if(oneIn(4)) return; // don't move sometimes
        const [dx, dy] = randChoice(choices);
        this.move(dx, dy);
    }
}

const enemyTypes = {};

enemyTypes.Kobold = class Kobold extends BasicMeleeEnemy{
    constructor(...args) {
        super(...args);
        this.type = 'Kobold';
        this.icon = 'K';
        this.color = 0x11aa33;

        this.strength = Math.ceil(this.level / 2) + 1;
        this.precision = Math.floor(this.level / 2) + 1;
        this.weapon = weapons.dagger();
    }
}
