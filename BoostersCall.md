# Création et ouverture de boosters

## Code web3.js
```
const accounts = await web3.eth.getAccounts()

# Exemple on mint les NFT 1, 2 et 3
const minted = await collectibles.methods.mintNft("Metadata NFT 1").send({from:accounts[0]})
await collectibles.methods.mintNft("Metadata NFT 2").send({from:accounts[0]})
await collectibles.methods.mintNft("Metadata NFT 3").send({from:accounts[0]})

# On mint le booster (NFT 4)
await collectibles.methods.mintNft('BOOSTER').send({from:accounts[0]})

# On compose le booster (NFT 4) des NFT 1, 2, et 3
# On l'associe à une série d'id 2 et une saison d'id 1
var serieID = 2
var seasonID = 1
var liste_des_NFTs_dans_un_booster = ['1', '2', '3']
boosterNftID = 4
await collectibles.methods.assembleBooster(
    liste_des_NFTs_dans_un_booster,
    boosterNftID,
    serieID,
    seasonID
    ).send({from:accounts[0]})

# On ouvre le booster 4
await collectibles.methods.openBooster(4).send({from:accounts[0]})
```

## Logique
La logique de création des boosters est assez simple mais il faut faire attention à ne pas faire d'erreurs. Seul l'admin (Torekko) peut créer les boosters.
Un booster est un NFT comme les autres d'apparence lorsqu'on le mint (on le crée). Avec la fonction "assembleBooster", on va passer en premier paramètre la liste des NFTs qui vont former un pack, le contenu d'un booster (on peut en mettre autant qu'on veut) et en deuxième paramètre l'id d'un NFT qui est en fait un booster. Puis on donne en troisième paramètre l'id de la série à laquelle appartient ce booster (ex : 1 pour Torekko originals, 2 pour snk...). En dernier paramètre on donne l'id de la saison à laquelle appartient ce booster (ex : 1 pour hiver 2021, 2 pour printemps 2022...). C'est après le passage de cette fonction que le booster devient officiellement un booster sur la blockchain.
Lorsque le propriétaire d'un booster va appeler la fonction "openBooster" il va 'ouvrir' un booster en indiquant en paramètre l'id du booster qu'il veut ouvrir. Une fonction aléatoire va alors parcourir tous les 'packs' de NFTs formés préalablement et en choisir un. Les NFTs de ce pack vont être transférés à l'utilisateur et le booster va être détruit.