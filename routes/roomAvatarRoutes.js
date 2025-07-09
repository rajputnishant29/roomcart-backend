const express = require('express');
const router = express.Router();
require('dotenv').config();

const BASE_URL = process.env.BASE_URL;

router.get('/', (req, res) => {
  const avatarList = [
    `${BASE_URL}/HouseAvatar01.jpeg`,
    `${BASE_URL}/HouseAvatar02.jpeg`,
    `${BASE_URL}/HouseAvatar03.jpeg`,
    `${BASE_URL}/HouseAvatar04.jpeg`,
  ];
  res.json({ avatars: avatarList });
});

module.exports = router;
