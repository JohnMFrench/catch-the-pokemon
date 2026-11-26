/* Which Pokémon can show up, in National Dex order (that order IS the grid).
   types / h / w come from PokeAPI; `dex` is the in-world line, `real` is a
   real-world science fact for the same idea. tools/verify_site.py checks that
   every id here has artwork. */
window.ROSTER = [
  { id: 1, name: 'Bulbasaur', types: ['Grass', 'Poison'], h: 0.7, w: 6.9,
    dex: "The seed on its back drinks sunshine and grows a little every day.",
    real: "Plants make their own food out of sunlight, water and air. That is called photosynthesis, and it is why leaves are green." },

  { id: 4, name: 'Charmander', types: ['Fire'], h: 0.6, w: 8.5,
    dex: "The flame on its tail shows how it feels - it flickers when Charmander is happy.",
    real: "Fire needs three things: fuel, air and heat. Take any one away and it goes out, which is why a glass over a candle puts it out." },

  { id: 6, name: 'Charizard', types: ['Fire', 'Flying'], h: 1.7, w: 90.5,
    dex: "Charizard flies high over mountains on huge wings, and its fire burns hotter when it is angry.",
    real: "Hot air is lighter than cold air, so it rises. That is how hot-air balloons float and why big birds can circle upward without flapping." },

  { id: 7, name: 'Squirtle', types: ['Water'], h: 0.5, w: 9.0,
    dex: "It pulls its head into its shell and squirts water to chase enemies away.",
    real: "A turtle's shell is part of its skeleton - about 50 bones joined together. The turtle can never climb out of it." },

  { id: 25, name: 'Pikachu', types: ['Electric'], h: 0.4, w: 6.0,
    dex: "Pikachu stores electricity in the pouches on its cheeks and lets it go when it is startled.",
    real: "Electric eels make their own electricity with special cells. A big one can send 600 volts through the water." },

  { id: 39, name: 'Jigglypuff', types: ['Normal', 'Fairy'], h: 0.5, w: 5.5,
    dex: "It sings a sleepy song, then gets cross when nobody stays awake to hear the end.",
    real: "Sound travels as invisible waves through the air. Louder sounds carry more energy, which is why they can make your ears ring." },

  { id: 52, name: 'Meowth', types: ['Normal'], h: 0.4, w: 4.2,
    dex: "Meowth loves anything shiny and keeps a secret stash of coins in a safe place.",
    real: "A cat's eye has a shiny layer behind the retina that bounces light back out. That is why cats' eyes glow in the dark." },

  { id: 54, name: 'Psyduck', types: ['Water'], h: 0.8, w: 19.6,
    dex: "Its headaches make its strange powers stronger, though it can never remember why.",
    real: "Ducks can stay underwater for a minute or more because they slow their heartbeat right down while they dive." },

  { id: 58, name: 'Growlithe', types: ['Fire'], h: 0.7, w: 19.0,
    dex: "Growlithe is brave and loyal, and barks loudly to warn its friends of danger.",
    real: "A dog's nose has about 300 million scent detectors. A person has roughly six million, so dogs really do smell more of the world." },

  { id: 63, name: 'Abra', types: ['Psychic'], h: 0.9, w: 19.5,
    dex: "Abra sleeps eighteen hours a day, yet it can vanish before danger ever touches it.",
    real: "Sleep is when your brain files away what you learned that day. That is why a good night's sleep helps you remember things." },

  { id: 94, name: 'Gengar', types: ['Ghost', 'Poison'], h: 1.5, w: 40.5,
    dex: "Gengar hides inside shadows and giggles at anyone it manages to frighten.",
    real: "A shadow is not a thing - it is just a patch of ground that light could not reach because something got in the way." },

  { id: 95, name: 'Onix', types: ['Rock', 'Ground'], h: 8.8, w: 210.0,
    dex: "It tunnels through the earth at 80 km/h, so the ground rumbles long after it has gone.",
    real: "The Grand Canyon was carved by one river, grain by grain, over six million years. Slow things add up." },

  { id: 129, name: 'Magikarp', types: ['Water'], h: 0.9, w: 10.0,
    dex: "Magikarp flops about uselessly, but legends say it can leap clean over a mountain.",
    real: "Real carp can jump a metre out of the water. Fish jump to escape predators, to catch insects, or to get over a barrier." },

  { id: 130, name: 'Gyarados', types: ['Water', 'Flying'], h: 6.5, w: 235.0,
    dex: "When Magikarp changes, all that fury turns it into a sea dragon that can flatten a town.",
    real: "When an animal is brought somewhere it does not belong, it can push the locals out. Scientists call that an invasive species." },

  { id: 131, name: 'Lapras', types: ['Water', 'Ice'], h: 2.5, w: 220.0,
    dex: "Lapras carries people across the sea on its back and sings a sad song as it swims.",
    real: "Sea turtles swim thousands of kilometres across open ocean and still find the right beach, by sensing Earth's magnetic field." },

  { id: 133, name: 'Eevee', types: ['Normal'], h: 0.3, w: 6.5,
    dex: "Eevee can become many different Pokémon, depending on where it grows up and what it lives through.",
    real: "Every dog breed came from one wolf-like ancestor, shaped by people choosing which puppies to breed." },

  { id: 143, name: 'Snorlax', types: ['Normal'], h: 2.1, w: 460.0,
    dex: "Snorlax eats 400 kg of food a day and then sleeps until it is hungry again.",
    real: "A hibernating bear's heart slows to a few beats a minute. It does not eat, drink or go to the toilet for months." },

  { id: 147, name: 'Dratini', types: ['Dragon'], h: 1.8, w: 3.3,
    dex: "Dratini sheds its skin as it grows and hides in the water until the new skin is ready.",
    real: "Snakes and lizards moult: they shed their old skin in one piece so they can grow a bigger one underneath." },

  { id: 149, name: 'Dragonite', types: ['Dragon', 'Flying'], h: 2.2, w: 210.0,
    dex: "Dragonite can circle the whole world in sixteen hours and will still stop to guide a lost ship home.",
    real: "The Arctic tern flies from the North Pole to the South Pole and back every year - about 70,000 km." },

  { id: 150, name: 'Mewtwo', types: ['Psychic'], h: 2.0, w: 122.0,
    dex: "Mewtwo was built in a laboratory from Mew's DNA, and it thinks too hard about why it exists.",
    real: "DNA is the instruction book for a living thing. Almost every cell in your body carries a full copy of yours." },

  { id: 151, name: 'Mew', types: ['Psychic'], h: 0.4, w: 4.0,
    dex: "Mew is so rare that most people believe it is only a story told to children.",
    real: "The coelacanth was known only from fossils and everyone thought it was extinct, until a live one was caught in 1938." },

  { id: 152, name: 'Chikorita', types: ['Grass'], h: 0.9, w: 6.4,
    dex: "The leaf on its head finds the sunny spots, and Chikorita follows the warmth all day.",
    real: "Sunflowers turn to follow the sun across the sky. The stem grows faster on the shaded side, which tips the flower over." },

  { id: 155, name: 'Cyndaquil', types: ['Fire'], h: 0.5, w: 7.9,
    dex: "Cyndaquil's back bursts into flame when it is startled, so it is easy to tell when it is cross.",
    real: "Fireflies and some deep-sea fish make their own light from a chemical reaction inside their bodies. It is called bioluminescence." },

  { id: 158, name: 'Totodile', types: ['Water'], h: 0.6, w: 9.5,
    dex: "Totodile bites first and thinks later, and its jaws can crush solid rock.",
    real: "A saltwater crocodile has the strongest bite of any animal alive - about the force of a small car resting on you." },

  { id: 175, name: 'Togepi', types: ['Fairy'], h: 0.3, w: 1.5,
    dex: "Togepi stores up happiness inside its shell and shares it with anyone who is kind to it.",
    real: "An eggshell looks fragile, but its curved shape spreads the force - the same trick that keeps bridges and domes standing." },

  { id: 183, name: 'Marill', types: ['Water', 'Fairy'], h: 0.4, w: 8.5,
    dex: "The ball on its tail is full of oil, so Marill floats on the water without even trying.",
    real: "Things float when they weigh less than the water they push out of the way. That is how a steel ship floats even though a nail sinks." },

  { id: 197, name: 'Umbreon', types: ['Dark'], h: 1.0, w: 27.0,
    dex: "Umbreon's rings glow when it is ready to fight, and it hunts without making a sound.",
    real: "Under ultraviolet light, scorpions glow blue-green and so does the fur of many ordinary mammals. You just cannot see it with your eyes." },

  { id: 212, name: 'Scizor', types: ['Bug', 'Steel'], h: 1.8, w: 118.0,
    dex: "Its steel claws are so sharp that Scizor can cut a tree trunk in half without slowing down.",
    real: "Spider silk is stronger than steel of the same thickness and stretchier than rubber - weight for weight it is one of the toughest materials known." },

  { id: 258, name: 'Mudkip', types: ['Water'], h: 0.4, w: 7.6,
    dex: "Mudkip can shove a boulder aside with its fin, and it naps in the mud when nobody is looking.",
    real: "Axolotls are real animals that can regrow a lost leg - bone, muscle and skin - in about two months." },

  { id: 321, name: 'Wailord', types: ['Water'], h: 14.5, w: 398.0,
    dex: "Wailord is the biggest Pokémon of all, and when it leaps the splash can be seen for miles.",
    real: "The blue whale is the largest animal that has ever lived: 30 metres long and heavier than any dinosaur we have found." },

  { id: 384, name: 'Rayquaza', types: ['Dragon', 'Flying'], h: 7.0, w: 206.5,
    dex: "Rayquaza lives above the clouds and only comes down when two other legendary Pokémon start a fight.",
    real: "Earth's ozone layer is a thin band of gas 15 to 30 km up. It blocks the Sun's harmful ultraviolet light from reaching us." },

  { id: 393, name: 'Piplup', types: ['Water'], h: 0.4, w: 5.2,
    dex: "Piplup is proud and refuses help, even when it has got itself completely lost.",
    real: "Penguins cannot fly in the air, but underwater they fly at 35 km/h, using the same wing beats." },

  { id: 448, name: 'Lucario', types: ['Fighting', 'Steel'], h: 1.2, w: 54.0,
    dex: "Lucario reads the aura of living things, so it knows exactly where you are even with its eyes shut.",
    real: "Bats find their way in total darkness by shouting and listening for the echo. It is called echolocation." },

  { id: 658, name: 'Greninja', types: ['Water', 'Dark'], h: 1.5, w: 40.0,
    dex: "Greninja moves so fast it seems to vanish, and it folds water into throwing stars.",
    real: "Some frogs can sprint across water for a moment by spreading their toes wide, to push the water sideways instead of down." },

  { id: 700, name: 'Sylveon', types: ['Fairy'], h: 1.0, w: 23.5,
    dex: "Sylveon wraps its ribbon-like feelers around the people it trusts, and never lets go first.",
    real: "A ribbon is a flat strip, and flat shapes spread a pull along their whole width instead of one thin point, which is why straps hold so well." },

  { id: 722, name: 'Rowlet', types: ['Grass', 'Flying'], h: 0.3, w: 1.5,
    dex: "Rowlet can turn its head almost all the way round, and flies without making a single sound.",
    real: "An owl's feathers have fringed edges that break up the air. That is why owls fly silently and can hear a mouse under the snow." },

  { id: 725, name: 'Litten', types: ['Fire'], h: 0.4, w: 4.3,
    dex: "Litten grooms itself all day long, and its fur is soaked in oil that catches fire easily.",
    real: "Hair, fur, fingernails and rhino horn are all made of the same material: keratin, a tough protein." },

  { id: 778, name: 'Mimikyu', types: ['Ghost', 'Fairy'], h: 0.2, w: 0.7,
    dex: "Mimikyu wears a home-made Pikachu costume because it wants to be loved as much as Pikachu is.",
    real: "The viceroy butterfly copies the colours of the poisonous monarch. Birds leave it alone because they think it is the one that tastes bad." },

  { id: 813, name: 'Scorbunny', types: ['Fire'], h: 0.3, w: 4.5,
    dex: "Scorbunny's feet get hot enough to throw sparks when it runs flat out.",
    real: "A rabbit's ears are packed with blood vessels and work like radiators, letting the rabbit dump heat on a hot day." },

  { id: 906, name: 'Sprigatito', types: ['Grass'], h: 0.4, w: 4.1,
    dex: "The gentle scent that comes off its fur calms everybody standing nearby.",
    real: "Plants release chemicals into the air to warn their neighbours when insects start eating them." },

  { id: 909, name: 'Fuecoco', types: ['Fire'], h: 0.4, w: 9.8,
    dex: "Fuecoco is a lazy fire croc that soaks up heat through the scales on its belly.",
    real: "Crocodiles swallow stones on purpose. The stones grind up food inside them and help the crocodile float the right way up." },

  { id: 912, name: 'Quaxly', types: ['Water'], h: 0.5, w: 6.1,
    dex: "Quaxly's hair stays perfectly in place however far it swims, thanks to a special gel it makes itself.",
    real: "A duck's feathers are waterproofed by oil that the bird spreads on them from a gland near its tail." }
];
