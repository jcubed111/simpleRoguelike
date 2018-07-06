class Weapon{
    constructor(props){
        this.melee = true;
        this.range = 0;
        this.damage = 0;
        this.critDamage = 0;
        this.critOn = 20;
        this.hitBonus = '0';
        this.spell = null;

        _.extend(this, props);
    }

    evalDiceNotation(dice, playerScores) {
        let total = 0;
        dice.split(/ *\+ */).forEach(d => {
            let match;
            if(d.match(/^[-0-9]+$/)) {
                total += +d;
                return;
            }
            if(match = d.match(/^([-0-9]+)d([0-9]+)$/)) {
                const num = +match[1];
                const dieSize = +match[2];
                for(let i=0; i<num; i++) {
                    total += randInt(1, dieSize+1);
                }
                return;
            }
            if(match = d.match(/^([-0-9]*)(str|sol|pre|voi|lvl)$/)) {
                let factor = match[1];
                if(factor == '-') factor = -1;
                if(factor == '') factor = 1;
                const stat = match[2];
                total += factor * playerScores[stat];
                return;
            }
            console.error('unrecognized dice notation block: ' + d);
        });
        return total;
    }

    rollToHit(playerScores) {
        const roll = randInt(1, 21);
        if(roll == 1) return 'miss';
        if(roll >= this.critOn) {
            return 'crit';
        }
        return roll + this.evalDiceNotation(this.hitBonus, playerScores);
    }

    rollDamage(playerScores) {
        return this.evalDiceNotation(this.damage, playerScores);
    }

    rollCritDamage(playerScores) {
        return this.evalDiceNotation(this.critDamage, playerScores);
    }
}

const weapons = {};

weapons.none = () => null;

weapons.sword = () => new Weapon({
    typeName: 'sword',
    melee: true,
    damage: '1d4 + 1str',
    critDamage: '2d4 + 2str',
    critOn: 20,
    hitBonus: 'pre',
});

weapons.dagger = () => new Weapon({
    typeName: 'dagger',
    melee: true,
    damage: '1d4',
    critDamage: '2d4',
    critOn: 19,
    hitBonus: '2pre',
});

weapons.lyre = () => new Weapon({
    typeName: 'lyre',
    melee: true,
    damage: '1d2',
    critDamage: '0',
    critOn: 21,
    hitBonus: '0',
    spell: new spells.SongOfFriendship(),
});
