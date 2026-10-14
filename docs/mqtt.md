---
sidebar_position: 2
description: Ο MQTT broker του m-powered.gr, η διαφορά μεταξύ MQTT module και uplink κόμβου και τα στοιχεία σύνδεσης για το κοινοτικό δίκτυο.
---

# MQTT και uplinks της κοινότητας

Το MQTT είναι πρωτόκολλο ανταλλαγής μηνυμάτων μέσω ενός broker. Στο δίκτυο του Meshtastic Greece Community, τα MQTT uplinks προωθούν πακέτα Meshtastic προς το `mqtt.m-powered.gr` για τα [εργαλεία monitoring](./community-tools).

`πακέτο LoRa → MQTT uplink κόμβος → mqtt.m-powered.gr → Meshview / Malla / χάρτης`

## Module, uplink και ρυθμίσεις καναλιού

Το **MQTT module** είναι η λειτουργία που συνδέει τη συσκευή στον broker. Ένας **MQTT uplink κόμβος** (ή MQTT gateway) λαμβάνει πακέτα μέσω LoRa και τα ανεβάζει στον broker. Χρειάζεται πρόσβαση στο διαδίκτυο, απευθείας ή μέσω υποστηριζόμενου client proxy.

| Ρύθμιση | Τι ελέγχει |
| --- | --- |
| MQTT module — `enabled` | Ενεργοποιεί τη σύνδεση της συσκευής στον MQTT broker, με τα κατάλληλα στοιχεία σύνδεσης και πρόσβαση στο διαδίκτυο. |
| Channel uplink | Επιτρέπει στο gateway να ανεβάζει πακέτα του συγκεκριμένου καναλιού. |
| Channel downlink | Αφορά τη διαδρομή MQTT → mesh. Στο κοινοτικό δίκτυο το κρατάμε απενεργοποιημένο. |
| `OK to MQTT` — `configOkToMqtt` | Δηλώνει ότι επιτρέπεις την προώθηση των πακέτων σου προς δημόσιο MQTT από άλλους κόμβους. Δεν ενεργοποιεί το MQTT module. |
| `Ignore MQTT` — `ignoreMqtt` | Αγνοεί πακέτα που λαμβάνονται μέσω LoRa και έχουν περάσει από MQTT. Δεν εμποδίζει το uplink ούτε επιβάλλει την πολιτική του broker. |

Για καθημερινή επικοινωνία μέσω LoRa δεν χρειάζεται να λειτουργείς δικό σου uplink. Τα πακέτα σου μπορούν να φτάσουν στο monitoring μέσω γειτονικού gateway, χωρίς ο δικός σου κόμβος να έχει σύνδεση στο διαδίκτυο.

## Στοιχεία σύνδεσης

Για κόμβο που θα λειτουργεί ως MQTT uplink, ενεργοποίησε το MQTT module και συμπλήρωσε τα παρακάτω στις ρυθμίσεις MQTT του Meshtastic app. Σε αρχείο YAML, τα πεδία ανήκουν στο `module_config.mqtt`.

| Ρύθμιση | Τιμή |
| --- | --- |
| Server address — `address` | `mqtt.m-powered.gr` |
| TCP port | `1883` |
| TLS enabled — `tlsEnabled` | Απενεργοποιημένο — `false` |
| Username — `username` | `meshdev` |
| Password — `password` | `large4cats` |
| Root topic — `root`, για NarrowSlow | `msh/EU_N_868/GR` |

Για παλιό uplink με LongFast, το root topic είναι `msh/EU_868/GR`. Το root είναι πρόθεμα των MQTT topics· δεν αλλάζει το region ή το preset LoRa. Για το τρέχον κοινοτικό δίκτυο χρησιμοποίησε το [προφίλ ρυθμίσεων NarrowSlow](./configuration-generator?preset=NarrowSlow).

Στα κανάλια που θα προωθεί το gateway, κράτησε **uplink ενεργό** και **downlink απενεργοποιημένο**. Ο ρόλος της συσκευής είναι ξεχωριστή επιλογή από το MQTT module· δες τη [σύγκριση ρόλων](./network-settings#ποιον-ρόλο-να-επιλέξεις).

## Τι κάνει ο δικός μας broker

Η κοινοτική υπηρεσία χρησιμοποιεί MQTT για monitoring, όχι για γεφύρωση περιοχών που δεν συνδέονται ασύρματα. Ο server απορρίπτει subscriptions από κόμβους ώστε να εμποδίζει την επιστροφή κίνησης MQTT προς RF, ανεξάρτητα από τα channel downlink flags της συσκευής.

Με ενεργό downlink, πακέτα από άλλες περιοχές θα μπορούσαν να εισαχθούν στο τοπικό mesh και να αναμεταδοθούν μέσω LoRa, καταναλώνοντας το [κοινό airtime](./best-practices#airtime). Αν η κίνηση είναι μεγάλη, μπορεί να προκληθεί συμφόρηση και να μείνει λιγότερος χώρος για την τοπική επικοινωνία. Θέλουμε ένα ανθεκτικό RF mesh που να λειτουργεί χωρίς εξάρτηση από το διαδίκτυο.

Η ροή περιλαμβάνει όλους τους τύπους πακέτων Meshtastic που φτάνουν στην υποδομή, μαζί με δημόσια μηνύματα· δεν περιορίζεται σε telemetry. Για τη δημόσια εμφάνιση δεδομένων και τη διάκριση από κρυπτογραφημένα direct messages, διάβασε την [πολιτική απορρήτου](/privacy).

Οι επίσημες οδηγίες για το [MQTT module](https://meshtastic.org/docs/configuration/module/mqtt/), τα [κανάλια](https://meshtastic.org/docs/configuration/radio/channels/) και τις [ρυθμίσεις LoRa](https://meshtastic.org/docs/configuration/radio/lora/) περιγράφουν τις δυνατότητες του Meshtastic γενικά. Η παραπάνω λειτουργία αφορά τον broker του m-powered.gr.
