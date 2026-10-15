#!/usr/bin/env node
// Cifra i documenti di viaggio (voucher, biglietti, codici) in un unico file
// che l'app apre con una password, anche offline. Il file cifrato può stare
// sul sito pubblico: senza password è illeggibile.
//
// Uso:  PASSWORD='...' node tools/cifra_documenti.js CARTELLA
// CARTELLA contiene codici.json (schede con i codici) e le immagini JPG dei
// documenti, chiamate <id>-1.jpg, <id>-2.jpg… (id = quello in codici.json).
// I file originali NON vanno nel repository.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir = process.argv[2];
const password = process.env.PASSWORD;
if (!dir || !password) { console.error('Uso: PASSWORD=... node tools/cifra_documenti.js CARTELLA'); process.exit(1); }

const cards = JSON.parse(fs.readFileSync(path.join(dir, 'codici.json'), 'utf8'));
const files = fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort();
cards.forEach((c) => {
  c.pages = files.filter((f) => f.startsWith(c.id + '-'))
    .map((f) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64'));
});

// PBKDF2-SHA256 → chiave AES-256-GCM; stesso schema di WebCrypto nel browser
// (il tag di autenticazione va in coda al testo cifrato).
const ITER = 600000;
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(password, salt, ITER, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const plain = Buffer.from(JSON.stringify({ cards }), 'utf8');
const enc = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

const out = { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: salt.toString('base64'), iv: iv.toString('base64'), data: enc.toString('base64') };
const target = path.join(__dirname, '..', 'docs', 'documenti.enc.json');
fs.writeFileSync(target, JSON.stringify(out));
console.log('Scritto', target, '·', cards.length, 'schede ·', Math.round(enc.length / 1024), 'KB cifrati');
