const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const seniorService = require('../services/senior.service');

const list = asyncHandler(async (req, res) => {
  const data = await seniorService.listSeniors(req.user, req.query.ward_number);
  return success(res, 200, 'Senior profiles', data);
});

const getOne = asyncHandler(async (req, res) => {
  const data = await seniorService.getSenior(req.params.id, req.user);
  return success(res, 200, 'Senior profile', data);
});

const updateMine = asyncHandler(async (req, res) => {
  const data = await seniorService.updateMyProfile(req.user.id, req.body, req);
  return success(res, 200, 'Senior profile updated', data);
});

module.exports = { list, getOne, updateMine };
