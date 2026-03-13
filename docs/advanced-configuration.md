---
sidebar_position: 3
---

# Προχωρημένη Διαμόρφωση

Ρόλοι για σταθερούς κόμβους και το πώς λειτουργεί το zero-cost hops.

## Ρόλοι για Σταθερούς Κόμβους {#roller-gia-staterous-kombous}

Αν θέλεις να στήσεις κόμβο που επανεκπέμπει ενεργά, έχεις δύο επιλογές ανάλογα με την τοποθεσία και την υποδομή σου.

### `CLIENT_BASE`

Ο ρόλος για κόμβους σε ταράτσα ή ψηλό σταθερό σημείο που δεν είναι dedicated repeater. Επανεκπέμπει πάντα τα πακέτα από ή προς κόμβους που έχεις στα favorites, και χειρίζεται όλα τα υπόλοιπα σαν `CLIENT`. Συμμετέχει επίσης στο [zero-cost hops](#zero-cost-hops) μηχανισμό.

### `ROUTER_LATE` {#router}

Επανεκπέμπει όλα τα μηνύματα που ακούει, χωρίς εξαιρέσεις. Χρήσιμο μόνο αν ο κόμβος είναι σε εξαιρετική θέση με συνεχές ρεύμα και εξωτερική κεραία — ο μόνος σκοπός του είναι να εξυπηρετεί το mesh. Σε πυκνοκατοικημένη περιοχή ή με κακή τοποθεσία, επιβαρύνει το δίκτυο αντί να το βοηθά.

Καλές περιπτώσεις: ταράτσα με άπλετη θέα, αγροτική περιοχή χωρίς άλλους κόμβους, dedicated repeater με ηλιακό πάνελ. Όχι για προσωπικές ή κινητές συσκευές.

Διάβασε: [Choosing the Right Device Role](https://meshtastic.org/blog/choosing-the-right-device-role/)

## Zero-Cost Hops {#zero-cost-hops}

Κανονικά κάθε επανεκπομπή αφαιρεί ένα hop. Με zero-cost hops, κάποιοι κόμβοι μπορούν να επανεκπέμψουν χωρίς να μειωθεί ο μετρητής — το μήνυμα φτάνει πιο μακριά με τον ίδιο αριθμό hops.

Ισχύει μόνο αν συντρέχουν και οι τρεις παρακάτω:

1. Ο ρόλος του κόμβου που επανεκπέμπει είναι `ROUTER`, `ROUTER_LATE` ή `CLIENT_BASE`
2. Δεν είναι το πρώτο hop του πακέτου
3. Ο προηγούμενος κόμβος που αναμετέδωσε βρίσκεται στα favorites και ο ρόλος του είναι `ROUTER` ή `ROUTER_LATE`

Αν χάσει έστω και μία, το hop μετράει κανονικά. Ένα δίκτυο από `ROUTER` και `ROUTER_LATE` κόμβους που έχουν ο ένας τον άλλο στα favorites μπορεί να στείλει μηνύματα πιο μακριά από ό,τι υποδηλώνει το hop limit.

### Προτεινόμενα Favorites για Αθήνα

Αν έχεις `ROUTER_LATE` ή `CLIENT_BASE` κόμβο στην Αττική, πρόσθεσε αυτούς τους κόμβους στα favorites για να αξιοποιήσεις το zero-cost hops:

| Κόμβος | Hex ID | Ρόλος | Meshview |
|--------|--------|-------|---------|
| Parnitha ☀️ | `!ce51114b` | ROUTER | [🔗](https://meshview.m-powered.gr/node/3461419339) |
| Ypato ☀️ | `!909652e0` | ROUTER | [🔗](https://meshview.m-powered.gr/node/2425770720) |
| Eretria ☀️ | `!2cab220e` | ROUTER_LATE | [🔗](https://meshview.m-powered.gr/node/749412878) |
| Kitheronas ☀️ | `!7534b015` | ROUTER_LATE | [🔗](https://meshview.m-powered.gr/node/1966387221) |
| Chalkida ☀️ | `!8e66c621` | ROUTER_LATE | [🔗](https://meshview.m-powered.gr/node/2389100065) |

Για να προσθέσεις favorite, πήγαινε στον κόμβο στην εφαρμογή Meshtastic → Node Info → Favorite.

Περισσότερα: [Zero-Cost Hops & Favorite Routers](https://meshtastic.org/blog/zero-cost-hops-favorite-routers/#when-do-zero-cost-hops-apply)
