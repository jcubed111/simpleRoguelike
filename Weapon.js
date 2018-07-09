function evalDiceNotation(dice, playerScores) {
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

class Weapon{
    constructor(props){
        this.name = undefined;
        this.level = 1;
        this.typeName = '???';
        this.hasSpecialName = true; // whether this item's name is different than its typeName
        this.melee = true;
        this.range = 0;
        this.ammoType = 'none';
        this.hitBonus = '0';
        this.damage = 0;
        this.critOn = 20; // 21 means no crit
        this.critDamage = 0;
        this.spell = null;

        _.extend(this, props);
        if(!this.name) {
            this.name = this.typeName;
            this.hasSpecialName = false;
        }
    }

    generateInfoBlock(indent = 0) {
        // ex:
        // %bDagger %d(level 1)
        //   %d-%r melee
        //   %d-%r range: %n4
        //   %d-%r ammo: %narrows
        //   %d-%r hit bonus: %n2pre
        //   %d-%r damage: %n1d4
        //   %d-%r crit class: %n19-20
        //   %d-%r crit damage: %n2d4

        let result = '%t' + titleCase(this.name);
        if(this.hasSpecialName) {
            result += ` %d(level ${this.level} ${this.typeName})`;
        }else{
            result += ` %d(level ${this.level})`;
        }
        if(this.melee) {
            result += `\n%d-%r melee`;
        }
        if(this.range) {
            result += `\n%d-%r range: %n${this.range}`;
        }
        if(this.ammoType != 'none') {
            result += `\n%d-%r ammo: %n${this.ammoType}`;
        }
        result += `\n%d-%r hit bonus: %n${this.hitBonus}`;
        result += `\n%d-%r damage: %n${this.damage}`;
        let critClass, showCritDamage = true;
        if(this.critOn < 20) {
            critClass = this.critOn + '-20';
        }else if(this.critOn == 20) {
            critClass = '20';
        }else{
            critClass = '%dno crit';
            showCritDamage = false;
        }
        result += `\n%d-%r crit class: %n${critClass}`;
        if(showCritDamage) {
            result += `\n%d-%r crit damage: %n${this.critDamage}`;
        }

        if(this.spell) {
            result += '\n' + this.spell.generateInfoBlock(indent + 2);
        }

        const padding = " ".repeat(indent);
        return result.split('\n').map(l => padding + l).join('\n');
    }

    rollToHit(playerScores) {
        const roll = randInt(1, 21);
        if(roll == 1) return 'miss';
        if(roll >= this.critOn) {
            return 'crit';
        }
        return roll + evalDiceNotation(this.hitBonus, playerScores);
    }

    rollDamage(playerScores) {
        return evalDiceNotation(this.damage, playerScores);
    }

    rollCritDamage(playerScores) {
        return evalDiceNotation(this.critDamage, playerScores);
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
