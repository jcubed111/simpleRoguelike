function $(text, c) {
    return "<span class='"+c+"'>" + text + "</span>";
}

function title(t, className = 'title') {
    return $(t, className);
}

function labelValue(label, value, valClass='value') {
    return $(label + ': ', 'label') + $(value, valClass);
}

function bulletedValue(value, valClass='value') {
    return $('- ', 'bullet') + $(value, valClass);
}

function bulletedLabelValue(label, value, valClass='value') {
    return $('- ', 'bullet') + labelValue(label, value, valClass);
}

function note(t) {
    return $(t, 'note');
}

function divider() {
    return $("---------------------------------------", 'divider');
}

function indentedTextBlock(indentLevel, t, className = 'value') {
    const padding = " ".repeat(indentLevel*4);
    const lineMaxLength = 40 - indentLevel*4;
    const parts = t.split(" ");

    let lines = [];
    let currentLine = "";
    while(parts.length) {
        const current = parts.shift();
        const lenToAdd = current.length;
        const spaceBefore = currentLine.length > 0 ? 1 : 0;
        if(currentLine.length + spaceBefore + lenToAdd <= lineMaxLength) {
            currentLine += spaceBefore ? ' ' : '';
            currentLine += current;
        }else{
            lines.push(currentLine);
            currentLine = current;
            while(currentLine.length > lineMaxLength) {
                lines.push(currentLine.substr(0, lineMaxLength));
                currentLine = currentLine.substr(lineMaxLength);
            }
        }
    }

    return $(lines.map(l => padding + l).join('\n'), className);
}

function padded(t, minLength, padding = " ") {
    const toAdd = Math.max(0, minLength - t.length);
    return t + padding.repeat(toAdd);
}

let html =
title("Human Bard - level 1") + 'n' +
labelValue("Exp", "0/5") + '\n' +
labelValue("HP", "10/10") + '\n' +
labelValue("AC", "7") + ' ' + note("(5 base + 1 armor + 1 dodge)") + '\n' +
labelValue("Movement", "regular") + '\n' +
divider() + '\n' +
padded(labelValue("strength", "1"), 16) +
padded(labelValue("soul", "0"), 0) + '\n' +
padded(labelValue("precision", "1"), 0) +
padded(labelValue("voice", "3"), 16) + '\n' +
divider() + '\n' +
labelValue("Unarmed Attack", "1", 'dice') + '\n' +
labelValue("Weapon", "Lyre - level 1", 'weaponTitle') + '\n' +
"    " + bulletedValue("melee") + '\n' +
"    " + bulletedLabelValue("hit bonus", "0", 'dice') + '\n' +
"    " + bulletedLabelValue("damage", "1d2", 'dice') + '\n' +
"    " + bulletedLabelValue("crit class", "no crit") + '\n' +
"    " + title("Song of Friendship", 'spellTitle') + '\n' +
"        " + bulletedLabelValue("target", "self") + '\n' +
"        " + bulletedLabelValue("range", "5") + '\n' +
"        " + bulletedLabelValue("description", "") + '\n' +
indentedTextBlock(3, "All characters in range become friendly for 1d6 + voi turns") + '\n' +
labelValue("Offhand Item", "none", 'noneValue') + '\n' +
labelValue("Helmet", "none", 'noneValue') + '\n' +
labelValue("Armor", "Cloth - level 1", 'armorTitle') + '\n' +
"    " + bulletedLabelValue("type", "light") + '\n' +
"    " + bulletedLabelValue("ac bonus", "1") + '\n' +
labelValue("Boots", "Winged Sandles", 'bootTitle') + '\n' +
"    " + bulletedLabelValue("ac bonus", "0") + '\n' +
"    " + title("Feather Fall", 'spellTitle') + '\n' +
"        " + bulletedValue("passive") + '\n' +
"        " + bulletedLabelValue("description", "") + '\n' +
indentedTextBlock(3, "The wearer does not take fall damage") + '\n' +
divider() + '\n' +
labelValue("Spells", "none", 'noneValue') + '\n' +
divider();
