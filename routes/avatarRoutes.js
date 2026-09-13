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
  `${BASE_URL}/avatar_07.png`,
  `${BASE_URL}/avatar_08.png`,
  `${BASE_URL}/avatar_09.png`,
  `${BASE_URL}/avatar_10.png`,
  `${BASE_URL}/avatar_11.png`,
  `${BASE_URL}/avatar_12.png`,
  `${BASE_URL}/avatar_13.png`,
  `${BASE_URL}/avatar_14.png`,
  `${BASE_URL}/avatar_15.png`,
  `${BASE_URL}/avatar_16.png`,
  `${BASE_URL}/avatar_17.png`,
  `${BASE_URL}/avatar_18.png`,
  `${BASE_URL}/avatar_19.png`,
  `${BASE_URL}/avatar_20.png`,
  '${BASE_URL}/avatar_21.png',
  `${BASE_URL}/avatar_22.png`,
  `${BASE_URL}/avatar_23.png`,
  `${BASE_URL}/avatar_24.png`,
];

router.get('/', (req, res) => {
  res.json({ avatars: AVATAR_LIST });
});

module.exports = router;
