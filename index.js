const Discord = require('discord.js');
const solver = require('./solver');

require('dotenv').config()

const client = new Discord.Client();

// TODO: customizable prefix per guild
const PREFIX = '.';

// Patterns match after prefix is removed
const PATTERNS = {
  help: /^help\s*$/i,
  play: /^play\s*(\w+)?\s*$/i,
  answer: /^answer\s*(.*)\s*$/i,
  hint: /^hint\s*$/i,
  surrender: /^surrender\s*$/i,
  solve: /^solve\s*(.*)\s*$/i,
};

function parse(message) {
  for (const type of Object.keys(PATTERNS)) {
    const matches = message.match(PATTERNS[type]);
    if (matches) {
      return {type, args: matches.slice(1)};
    }
  }
  return {type: null};
}

let games = {}; // [id#channel] -> {target, problem, solution}

function getChannelId(message) {
  if (message.guild) {
    return `${message.guild.id}#${message.channel.name}`;
  }
  // direct message
  return `${message.channel.id}#`;
}

function deleteGame(id) {
  if (!games.hasOwnProperty(id)) return;
  clearTimeout(games[id].timeout);
  delete games[id];
}

function help(args, message) {
  const embed = new Discord.MessageEmbed()
    .setColor('#008891')
    .setTitle('How to Play')
    .setURL('https://github.com/azaky/24-discord-bot')
    .setThumbnail('https://cdn.discordapp.com/avatars/798567222779314227/a47e8f1e8b4981b20a92d4574ef89ecd.png')
    // .setFooter('Github: https://github.com/azaky/24-discord-bot', 'https://github.githubassets.com/favicons/favicon-dark.png')
    .setDescription('**24** is a classic math game, where you are asked to **combine 4 numbers using operators +, -, \\*, /, ^ to get 24**.')
    .addFields(
      {
        name: 'Example',
        value: [
          'Using **5, 4, 3, 2**, you can get 24 in some ways:',
          '> `4*(5+3-2)`',
          '> `2^4 + 5 + 3`',
          'But you cannot \'combine\' the numbers, so the following is invalid:',
          '> `25 - (4 - 3)` is not allowed',
        ].join('\n'),
      },
      {
        name: `${PREFIX}play`,
        value: [
          `Start a new game.`,
          `> \`${PREFIX}play\``,
          `> \`${PREFIX}play 31\` using 31 as target`,
          `> \`${PREFIX}play random\` using random number as target`,
        ].join('\n'),
      },
      {
        name: `${PREFIX}answer`,
        value: [
          `Attempt to answer an ongoing game.`,
          `> \`${PREFIX}answer (3 + 3) * (6 - 2)\``,
          `> \`${PREFIX}answer 5^(8 / 4) - 1\``,
        ].join('\n'),
      },
      {
        name: `${PREFIX}hint`,
        value: `Ask me for hint to current game.`,
      },
      {
        name: `${PREFIX}surrender`,
        value: `Give in to current game.`,
      },
      {
        name: `${PREFIX}solve`,
        value: [
          `Ask me to solve for you.`,
          `> \`${PREFIX}solve 5 6 7 8\``,
          `> \`${PREFIX}solve 5 6 7 8 = 31\``,
        ].join('\n'),
      },
    );

  if (message.channel.type === 'dm') {
    embed.addField(
      'Other',
      [
        `Also, you can ignore the prefix \`${PREFIX}\` on direct messages.`,
        `Just type \`play\` to start a game.`,
      ].join('\n')
    );
  }

  const id = getChannelId(message);
  if (games.hasOwnProperty(id)) {
    embed.addField(
      'Current Game',
      [
        `It seems that you have ongoing game:`,
        ``,
        `Get **${games[id].target}** from numbers **${games[id].problem}**`,
      ].join('\n'),
    );
  }

  message.channel.send(embed);
}

function play(args, message) {
  const id = getChannelId(message);
  if (games.hasOwnProperty(id)) {
    message.channel.send([
      `A game is currently active! Send \`${PREFIX}surrender\` to give up.`,
      ``,
      `Current game: Get **${games[id].target}** from numbers **${games[id].problem}**`,
    ].join('\n'));
    return;
  }
  let target = 24, problem;
  if (args && args.length && typeof args[0] === 'string') {
    if (/^\s*random\s*$/i.test(args[0])) {
      ({target, problem} = solver.getProblemWithRandomTarget());
    } else {
      const matches = args[0].match(/^\s*(\d+)\s*$/);
      if (!matches) {
        message.channel.send(`Invalid syntax! Try \`${PREFIX}play\`, \`${PREFIX}play 31\`, or \`${PREFIX}play random\`. When specifying target, it must be a whole number between 0 and 100.`);
        return;
      }
      target = parseInt(matches[1]);
      if (isNaN(target) || target < 0 || target > 100) {
        message.channel.send(`Invalid syntax! Try \`${PREFIX}play\`, \`${PREFIX}play 31\`, or \`${PREFIX}play random\`. When specifying target, it must be a whole number between 0 and 100.`);
        return;
      }
    }
  }
  if (!problem) {
    problem = solver.getProblem(target);
  }
  games[id] = {
    problem,
    target,
    solution: solver.solvePrecomputed(problem, target),
    timestamp: new Date().getTime(),
  };
  console.log(games[id]);
  message.channel.send([
    `Here is a new problem for you! Answer with \`${PREFIX}answer <your answer>\` e.g. \`${PREFIX}answer 5 + 5 + 2*7\`.`,
    ``,
    `Get **${target}** from numbers **${problem}** using operators +, -, \\*, /, ^ (power), and parentheses!`,
  ].join('\n'));

  // Send hint after some amount of time
  games[id].timeout = setTimeout(() => {
    if (games.hasOwnProperty(id)) {
      message.channel.send([
        `Still struggling? Here is a little hint for you. If you are really really stuck, you can give in with \`${PREFIX}surrender\``,
        ``,
        `**${games[id].solution.replace(/[0-9]+/g, '?')}** = ${games[id].target}`,
      ].join('\n'));
    }
  }, 60000);
}

function answer(args, message) {
  const id = getChannelId(message);
  if (!games.hasOwnProperty(id)) {
    message.channel.send(`No game is active! Start a new one with \`${PREFIX}play\`.`);
    return;
  }

  const {valid, reason} = solver.check(args[0], games[id].problem, games[id].target);
  if (!valid) {
    message.channel.send(`Oops, wrong answer. **${reason.replace(/\*/g, '\\*')}**`);
    return;
  }

  const time = new Date().getTime() - games[id].timestamp;

  message.react('💯');

  // Appreciate more to quick solvers!
  if (time < 4000) {
    message.channel.send(`:100: points for <@${message.author.id}>! **${Math.floor(time/100)/10} seconds**. They said it could not be done. *They were wrong*.`);
  } else if (time < 7000) {
    message.channel.send(`:100: points for <@${message.author.id}>! You did it in an *impossible* time of **${Math.floor(time/100)/10} seconds**, unbelievable!!`);
  } else if (time < 12000) {
    message.channel.send(`:100: points for <@${message.author.id}>! Wow, it took you only **${Math.floor(time/100)/10} seconds**, superb!`);
  } else {
    message.channel.send(`:100: points for <@${message.author.id}>! Well done!`);
  }
  deleteGame(id);
}

function surrender(args, message) {
  const id = getChannelId(message);
  if (!games.hasOwnProperty(id)) {
    message.channel.send(`No game is active! Start a new one with \`${PREFIX}play\`.`);
    return;
  }

  message.channel.send([
    `That was a hard one, wasn't it? Alright, this is the solution:`,
    ``,
    `**${games[id].solution.replace(/\*/g, '\\*')}** = ${games[id].target}`,
  ].join('\n'));
  deleteGame(id);
}

function hint(args, message) {
  const id = getChannelId(message);
  if (!games.hasOwnProperty(id)) {
    message.channel.send(`No game is active! Start a new one with \`${PREFIX}play\`.`);
    return;
  }

  message.channel.send(`Here is a little hint for you: **${games[id].solution.replace(/[0-9]+/g, '#')}** = ${games[id].target}`);
}

function solve(args, message) {
  let input = args[0], target = 24;
  if (input.indexOf('=') !== -1) {
    [input, target] = input.split('=');
    const matches = target.match(/^\s*(\d+)\s*$/);
    if (!matches) {
      message.channel.send('Invalid target! Target must be a whole number.');
      return;
    }
    target = parseInt(matches[1]);
    if (isNaN(target)) {
      message.channel.send('Invalid target! Target must be a whole number.');
      return;
    }
  }

  input = (input.match(/[0-9]+/g) || []).map(a => parseInt(a));
  if (input.length < 1 || input.length > 4) {
    message.channel.send('Invalid input! Input numbers must consist of 1-4 whole numbers.');
    return;
  }

  const solution = solver.solve(input, target);
  if (!solution) {
    message.channel.send(`No solution found for ${args[0]} 🙁`);
  } else {
    message.channel.send(`That's an easy one! **${solution.replace('*', '\\*')} = ${target}**`)
  }
}

client.on('message', (message) => {
  let content = message.content;
  // TODO: handle mentions
  if (content.startsWith(PREFIX)) {
    content = content.slice(PREFIX.length);
  } else {
    // allow no prefix in DMs
    if (message.channel.type !== 'dm') return;
  }

  const msg = parse(content);
  if (!msg || !msg.type) {
    return;
  }

  let channelInfo;
  if (message.guild) {
    channelInfo = `channel=#[${message.channel.name}] server=[${message.guild.name}] server_id=${message.guild.id}`;
  } else {
    channelInfo = `channel=${message.channel.id} (dm)`;
  }
  let userInfo = `user=@[${message.author.username}] user_id=${message.author.id}`;
  console.log(`New message: ${userInfo} ${channelInfo}`);
  console.log(msg);

  switch (msg.type) {
    case 'help':
      help(msg.args, message);
      break;
    
    case 'play':
      play(msg.args, message);
      break;

    case 'answer':
      answer(msg.args, message);
      break;

    case 'hint':
      hint(msg.args, message);
      break;

    case 'surrender':
      surrender(msg.args, message);
      break;

    case 'solve':
      solve(msg.args, message);
      break;
  }
});

solver.init();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setActivity(`24 | ${PREFIX}play | ${PREFIX}help`, { type: 'PLAYING' });
});

client.on('guildCreate', guild => {
  console.log(`Added to server=[${guild.name}] server_id=${guild.id}`);
  if (guild.systemChannel && guild.systemChannel.permissionsFor(guild.me).has('SEND_MESSAGES')) {
    guild.systemChannel.send('Thanks for adding me! Type `!play` to start playing 24, or `!help` for more information.');
  }
});

client.login(process.env.DISCORD_TOKEN);
