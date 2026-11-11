const { asyncHandler } = require('../utils/asyncHandler');
const { success } = require('../utils/response');
const volunteerService = require('../services/volunteer.service');
const volunteerModel = require('../models/volunteerProfile.model');

const list = asyncHandler(async (req, res) => {
  const rows = await volunteerService.listVolunteers(req.query);
  return success(res, 200, 'Volunteers', rows.map(volunteerModel.publicVolunteer));
});

const verify = asyncHandler(async (req, res) => {
  const profile = await volunteerService.verifyVolunteer({
    id: req.params.id,
    nextStatus: req.body.verification_status,
    policeId: req.user.id,
    req,
  });
  return success(res, 200, `Volunteer moved to ${profile.verification_status}`, {
    volunteer_profile: profile,
  });
});

const pingLocation = asyncHandler(async (req, res) => {
  const lat = req.body.latitude ?? req.body.lat;
  const lng = req.body.longitude ?? req.body.lng;
  const profile = await volunteerService.updateMyLocation(req.user.id, lat, lng);
  return success(res, 200, 'Location updated', { volunteer_profile: profile });
});

const getMine = asyncHandler(async (req, res) => {
  const profile = volunteerModel.publicVolunteer(await volunteerModel.findByUserId(req.user.id));
  return success(res, 200, 'Volunteer profile', { volunteer_profile: profile });
});

module.exports = { list, verify, pingLocation, getMine };
