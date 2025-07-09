const express = require('express');
const router = express.Router();
require('dotenv').config();

const BASE_URL = process.env.BASE_URL;

const AVATAR_LIST = [
  `${BASE_URL}/avatar_01.jpg`,
  `${BASE_URL}/avatar_02.jpg`,
  `${BASE_URL}/avatar_03.jpg`,
  `${BASE_URL}/avatar_04.png`,
  `${BASE_URL}/avatar_05.png`,
  `${BASE_URL}/avatar_06.png`,
];

router.get('/', (req, res) => {
  res.json({ avatars: AVATAR_LIST });
});

module.exports = router;
