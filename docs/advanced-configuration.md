---
sidebar_position: 3
---

# Προχωρημένη Διαμόρφωση

Ρόλοι για σταθερούς κόμβους και το πώς λειτουργεί το zero-cost hops.

## Ρόλοι για Σταθερούς Κόμβους {#roller-gia-staterous-kombous}

Αν θέλεις να στήσεις κόμβο που επανεκπέμπει ενεργά, έχεις δύο επιλογές ανάλογα με την τοποθεσία και την υποδομή σου.

### `CLIENT_BASE`

Αν έχεις κόμβο σε ταράτσα ή ψηλό σημείο που δεν είναι αποκλειστικά repeater, ο ρόλος `CLIENT_BASE` είναι ιδανικός. Επανεκπέμπει γρήγορα τα μηνύματα από ή προς κόμβους που έχεις στα favorites (early window), ενώ τα υπόλοιπα τα χειρίζεται σαν απλός `CLIENT`. Συμμετέχει και στο [zero-cost hops](#zero-cost-hops).

**Τι σημαίνουν τα favorites εδώ:**

Ο `CLIENT_BASE` λειτουργεί με δύο τρόπους:

1. **Γρήγορη επανεκπομπή:** Αν ο αποστολέας ή ο παραλήπτης είναι στα favorites, το μήνυμα επανεκπέμπεται αμέσως. Έτσι, οι φορητές σου συσκευές έχουν σίγουρη κάλυψη από τον κόμβο της ταράτσας.

2. **Zero-cost hops:** Αν ένας favorited `ROUTER` ή `ROUTER_LATE` στείλει προς τον `CLIENT_BASE`, το hop δεν μετράει. Όμως ο `CLIENT_BASE` δεν δημιουργεί zero-cost hops μόνο με τα δικά του favorites.

**Παράδειγμα:** Έχεις `CLIENT_BASE` στην ταράτσα και φορητούς `CLIENT` ή `CLIENT_MUTE` στο σπίτι. Βάζεις τους φορητούς στα favorites του `CLIENT_BASE` και έτσι τα μηνύματά τους περνάνε πάντα γρήγορα από τον σταθερό κόμβο.

### `ROUTER_LATE` {#router}

Επανεκπέμπει όλα τα μηνύματα που ακούει, χωρίς εξαιρέσεις. Χρήσιμο μόνο αν ο κόμβος είναι σε εξαιρετική θέση με συνεχές ρεύμα και εξωτερική κεραία — ο μόνος σκοπός του είναι να εξυπηρετεί το mesh. Σε πυκνοκατοικημένη περιοχή ή με κακή τοποθεσία, επιβαρύνει το δίκτυο αντί να το βοηθά.

**Τι κάνει το ROUTER_LATE διαφορετικό από το ROUTER:**

- **ROUTER**: Επανεκπέμπει πάντα στο early contention window (προτεραιότητα), καταπνίγοντας άλλους κόμβους.
- **ROUTER_LATE**: Επανεκπέμπει στο default window σαν CLIENT, αλλά αν ακούσει κάποιον άλλο να επανεκπέμψει, αναβάλλει για το late window. Αυτό εξασφαλίζει ότι δεν παρεμποδίζει το φυσικό routing αλλά εξυπηρετεί σαν backup για dead spots.

**Zero-cost hops με ROUTER/ROUTER_LATE:**

Και οι δύο ρόλοι συμμετέχουν στο zero-cost hops. Όταν ένας `ROUTER` ή `ROUTER_LATE` επανεκπέμπει μετά από έναν άλλον favorited `ROUTER`/`ROUTER_LATE`, δεν μειώνει το hop count. Αυτό τους καθιστά ιδανικούς για backbone υποδομή του δικτύου.

Καλές περιπτώσεις: ταράτσα με άπλετη θέα, αγροτική περιοχή χωρίς άλλους κόμβους, dedicated repeater με ηλιακό πάνελ. Όχι για προσωπικές ή κινητές συσκευές.

Διάβασε: [Choosing the Right Device Role](https://meshtastic.org/blog/choosing-the-right-device-role/) | [Demystifying ROUTER_LATE](https://meshtastic.org/blog/demystifying-router-late/)

## Zero-Cost Hops {#zero-cost-hops}

Κανονικά κάθε επανεκπομπή αφαιρεί ένα hop. Με zero-cost hops, κάποιοι κόμβοι μπορούν να επανεκπέμψουν χωρίς να μειωθεί ο μετρητής — το μήνυμα φτάνει πιο μακριά με τον ίδιο αριθμό hops.

### Πώς λειτουργεί

Το zero-cost hops **διαφέρει** από την early rebroadcast συμπεριφορά του `CLIENT_BASE`:

- **Early Rebroadcast** (CLIENT_BASE με favorites): Ελέγχει αν ο **αποστολέας** (from) ή ο **παραλήπτης** (to) είναι στα favorites → επανεκπέμπει γρήγορα στο early contention window.

- **Zero-Cost Hops** (ROUTER/ROUTER_LATE/CLIENT_BASE): Ελέγχει αν ο **προηγούμενος relay κόμβος** (relay_node) ήταν favorited ROUTER/ROUTER_LATE → δεν μειώνει το hop count.

Αυτά είναι δύο ξεχωριστοί μηχανισμοί που μπορούν να λειτουργήσουν ταυτόχρονα.

### Πότε ισχύει το Zero-Cost Hop

Ισχύει μόνο αν συντρέχουν **και οι τρεις** παρακάτω προϋποθέσεις:

1. Ο ρόλος του κόμβου που επανεκπέμπει είναι `ROUTER`, `ROUTER_LATE` ή `CLIENT_BASE`
2. Δεν είναι το πρώτο hop του πακέτου (το πρώτο hop πάντα μετράει)
3. Ο **προηγούμενος relay κόμβος** (relay_node) βρίσκεται στα favorites **και** ο ρόλος του είναι `ROUTER` ή `ROUTER_LATE`

Αν χάσει έστω και μία προϋπόθεση, το hop μετράει κανονικά. 

### Γιατί είναι χρήσιμο

Ένα δίκτυο από `ROUTER` και `ROUTER_LATE` κόμβους που έχουν ο ένας τον άλλο στα favorites μπορεί να λειτουργήσει ως "backbone" υποδομή — τα μηνύματα διασχίζουν την υποδομή σαν ένα μόνο hop, αφήνοντας περισσότερα hops για την πρώτη και τελευταία μίλια (τα άκρα του δικτύου).

**Παράδειγμα σεναρίου:**
Handheld CLIENT (4 hops) → CLIENT_BASE στην ταράτσα (3 hops) → ROUTER Πάρνηθα (3 hops, zero-cost!) → ROUTER Υπάτου (3 hops, zero-cost!) → CLIENT_BASE σε απομακρυσμένο σημείο (3 hops, zero-cost!) → CLIENT σε απομακρυσμένο handheld (2 hops) → Τελικός CLIENT (1 hop)

Χωρίς zero-cost hops, το μήνυμα θα εξαντλούσε τα hops στην υποδομή και δεν θα έφτανε στον τελικό παραλήπτη.

### Προτεινόμενα Favorites για Αθήνα

Αν έχεις `ROUTER_LATE` ή `CLIENT_BASE` κόμβο στην Αττική, πρόσθεσε αυτούς τους κόμβους στα favorites για να αξιοποιήσεις το zero-cost hops:

| Κόμβος | Hex ID | Ρόλος | Meshview |
|--------|--------|-------|---------|
| Parnitha ☀️ | `!ce51114b` | ROUTER | [🔗](https://meshview.m-powered.gr/node/3461419339) |
| Ypato ☀️ | `!909652e0` | ROUTER | [🔗](https://meshview.m-powered.gr/node/2425770720) |
| Eretria ☀️ | `!2cab220e` | ROUTER_LATE | [🔗](https://meshview.m-powered.gr/node/749412878) |
| Kitheronas ☀️ | `!7534b015` | ROUTER_LATE | [🔗](https://meshview.m-powered.gr/node/1966387221) |
| Chalkida ☀️ | `!8e66c621` | ROUTER_LATE | [🔗](https://meshview.m-powered.gr/node/2389100065) |

**Πώς να χρησιμοποιήσεις τα favorites:**

- **Για ROUTER/ROUTER_LATE κόμβους**: Πρόσθεσε τους παραπάνω backbone routers στα favorites για να ενεργοποιήσεις zero-cost hops μεταξύ υποδομής.

- **Για CLIENT_BASE κόμβους**: Πρόσθεσε **και** τους παραπάνω backbone routers (για zero-cost hops) **και** τις δικές σου φορητές συσκευές `CLIENT` (για early rebroadcast). Έτσι εξασφαλίζεις ότι ο CLIENT_BASE σου θα επανεκπέμψει αξιόπιστα τόσο τα μηνύματα των φορητών σου συσκευών όσο και θα επωφεληθεί από το zero-cost hops όταν επικοινωνεί με την backbone υποδομή.

**Πώς να προσθέσεις favorite:** Πήγαινε στον κόμβο στην εφαρμογή Meshtastic → Node Info → Favorite.

Περισσότερα: [Zero-Cost Hops & Favorite Routers](https://meshtastic.org/blog/zero-cost-hops-favorite-routers/#when-do-zero-cost-hops-apply)
