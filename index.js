const Discord = require('discord.js');
const solver = require('./solver');

require('dotenv').config()

const client = new Discord.Client();

const PATTERNS = {
  help: /^!help\s*$/i,
  play: /^!play\s*(\w+)?\s*$/i,
  answer: /^!answer\s*(.*)\s*$/i,
  hint: /^!hint\s*$/i,
  surrender: /^!surrender\s*$/i,
  solve: /^!solve\s*(.*)\s*$/i,
};

function parse(message) {
  if (!message.startsWith('!')) {
    return {type: null};
  }
  for (const type of Object.keys(PATTERNS)) {
    const matches = message.match(PATTERNS[type]);
    if (matches) {
      return {type, args: matches.slice(1)};
    }
  }
  return {type: null};
}

let games = {}; // [id#channel] -> {target, problem, solution}

const HELP_TEXT = '24 is a classic math game, where you are to **combine 4 numbers using arithmetic operators (+, -, \\*, /, ^) to get 24**. The target number 24 is arbitrary and can be changed.\n\n\
Here are the commands to play/interact with me:\n\
**`!play`**: Start a new game with default target 24.\n\
**`!play 31`**: Start a new game with target 31.\n\
**`!play random`**: Start a new game with random target.\n\n\
For `!answer`, `!hint`, and `!surrender`, a game must be currently ongoing.\n\
**`!answer (1+3)*(2+4)`**: Attempt to answer.\n\
**`!hint`**: Ask for hint to current game.\n\
**`!surrender`**: Give up and ask for the solution.\n\n\
**`!solve 1 2 3 4 = 31`**: Ask the bot to solve for you. If no "= target" is found, then 24 is assumed.\n\n\
**`!help`**: Show this help text.';

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
  message.channel.send(HELP_TEXT);
  if (message.channel.type === 'dm') {
    message.channel.send('Also, you can ignore prefix ! on direct messages with me! Just type `play` to start a game!');
  }
  const id = getChannelId(message);
  if (games.hasOwnProperty(id)) {
    message.channel.send(`Oh, and it seems that you have ongoing game:\n\nGet **${games[id].target}** from numbers **${games[id].problem}**`);
  }
}

function play(args, message) {
  const id = getChannelId(message);
  if (games.hasOwnProperty(id)) {
    message.channel.send(`A game is currently active! Send \`!surrender\` to give up.\n\nCurrent game: Get **${games[id].target}** from numbers **${games[id].problem}**`);
    return;
  }
  let target = 24, problem;
  if (args && args.length && typeof args[0] === 'string') {
    if (/^\s*random\s*$/i.test(args[0])) {
      ({target, problem} = solver.getProblemWithRandomTarget());
    } else {
      const matches = args[0].match(/^\s*(\d+)\s*$/);
      if (!matches) {
        message.channel.send('Invalid syntax! Try `!play`, `!play 31`, or `!play random`. When specifying target, it must be a whole number between 0 and 100.');
        return;
      }
      target = parseInt(matches[1]);
      if (isNaN(target) || target < 0 || target > 100) {
        message.channel.send('Invalid syntax! Try `!play`, `!play 31`, or `!play random`. When specifying target, it must be a whole number between 0 and 100.');
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
  message.channel.send(`Here is a new problem for you!\n\nGet **${target}** from numbers **${problem}**. You may use +, -, *, /, ^ (power), and parentheses. Type \`!answer <your answer>\` to answer!`);

  // Send hint after some amount of time
  games[id].timeout = setTimeout(() => {
    if (games.hasOwnProperty(id)) {
      message.channel.send(`Still struggling? Here is a little hint for you: **${games[id].solution.replace(/[0-9]+/g, '#')}** = ${games[id].target}. If you are really really stuck, you can give in with \`!surrender\``);
    }
  }, 60000);
}

function answer(args, message) {
  const id = getChannelId(message);
  if (!games.hasOwnProperty(id)) {
    message.channel.send('No game is active! Start a new one with `!play`.');
    return;
  }

  const {valid, reason} = solver.check(args[0], games[id].problem, games[id].target);
  if (!valid) {
    message.channel.send(`Oops, wrong answer. ${reason}`);
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
    message.channel.send('No game is active! Start a new one with `!play`.');
    return;
  }

  message.channel.send(`That was a hard one, wasn't it? Alright, this is the solution: **${games[id].solution}** = ${games[id].target}`);
  deleteGame(id);
}

function hint(args, message) {
  const id = getChannelId(message);
  if (!games.hasOwnProperty(id)) {
    message.channel.send('No game is active! Start a new one with `!play`.');
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
    message.channel.send(`That's an easy one! **${solution} = ${target}**`)
  }
}

client.on('message', (message) => {
  // auto-add prefix ! in direct messages
  let content = message.content;
  if (message.channel.type === 'dm' && !content.startsWith('!')) {
    content = `!${content}`;
  }
  const msg = parse(content);
  if (!msg || !msg.type) {
    return;
  }

  let channel;
  if (message.guild) {
    channel = `channel=#[${message.channel.name}] server=[${message.guild.name}] server_id=${message.guild.id}`;
  } else {
    channel = `channel=${message.channel.id} (dm)`;
  }
  console.log(`New message: user=@[${message.author.username}] user_id=${message.author.id} ${channel}`);
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
  client.user.setActivity('24 | !play | !help', { type: 'PLAYING' });
});

client.on('guildCreate', guild => {
  console.log(`Added to server=[${guild.name}] server_id=${guild.id}`);
  if (guild.systemChannel && guild.systemChannel.permissionsFor(guild.me).has('SEND_MESSAGES')) {
    guild.systemChannel.send('Thanks for adding me! Type `!play` to start playing 24, or `!help` for more information.');
  }
});

client.login(process.env.DISCORD_TOKEN);
