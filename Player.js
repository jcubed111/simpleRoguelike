const raceBases = {
    orc: {
        maxHp: 15,
        strength: 1,
        voice: -1,
        unarmedAttack: '1d3',
    },
    elf: {
        maxHp: 7,
        soul: 1,
        unarmedAttack: '1',
    },
    tiefling: {
        maxHp: 10,
        precision: 1,
        unarmedAttack: '1d2',
    },
    human: {
        maxHp: 10,
        voice: 1,
        unarmedAttack: '1',
    },
};

const classBases = {
    fighter: {
        strength: 1,
        weapon: weapons.sword,
        spells: [],
    },
    mage: {
        soul: 1,
        weapon: weapons.none,
        spells: [spells.MagicMissile],
    },
    rogue: {
        precision: 1,
        weapon: weapons.dagger,
        spells: [],
    },
    bard: {
        voice: 1,
        weapon: weapons.lyre,
        spells: [],
    }
}

class Player extends Character {
    constructor(world, race, className) {
        super(world);
        this.type = race + ' ' + className;
        this.humanoid = true;
        this.icon = '@';
        this.color = 0xdddddd;
        this.race = race;
        this.class = className;
        this.myTurn = true;
        this.level = 1;
        this.description = 'Self-proclaimed hero and loyal employee of Maroon Knights Adventuring Company';

        // get race base stuff
        this.maxHp = this.currentHp = raceBases[race].maxHp;
        this.unarmedAttack = raceBases[race].unarmedAttack;

        this.strength  += raceBases[race].strength || 0;
        this.soul      += raceBases[race].soul || 0;
        this.precision += raceBases[race].precision || 0;
        this.voice     += raceBases[race].voice || 0;

        // get class base stuff
        this.weapon = classBases[className].weapon();
        this.spells.push(...classBases[className].spells.map(s => new s()));

        this.strength  += classBases[className].strength || 0;
        this.soul      += classBases[className].soul || 0;
        this.precision += classBases[className].precision || 0;
        this.voice     += classBases[className].voice || 0;
    }

    isEnemy() { return false; }
    isPlayer() { return true; }

    getLogName() {
        return "you";
    }

    die() {
        // TODO
        this.world.log(`You die! :'(`);
        this.dead = true;
    }

    tryToMove(dx, dy) {
        // check if there is an enemy in that cell
        const toCell = this.world.map.at(this.x + dx, this.y + dy);
        const enemy = toCell.occupiedBy();
        if(enemy) {
            // melee attack!
            this.meleeAttack(enemy);
            this.endTurn();
            return;
        }

        if(!this.canMove(dx, dy)) return false;
        this.move(dx, dy);

        this.endTurn();
    }

    pass() {
        this.endTurn();
    }

    async endTurn() {
        const turnTime = 100; // ms

        // not my turn anymore
        this.myTurn = false;

        // update cell visibility
        this.world.updateCellVisibility();

        // pause ay my turn passes
        await delay(turnTime);

        // all other characters take turn
        await this.world.doAiTurns(turnTime);

        // my turn again
        this.myTurn = true;
    }
}
