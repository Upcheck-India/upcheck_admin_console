import axios from 'axios';

let zoomAccessToken = null;
let tokenExpiresAt = null;

const getZoomAccessToken = async () => {
  if (zoomAccessToken && tokenExpiresAt && new Date() < tokenExpiresAt) {
    return zoomAccessToken;
  }

  try {
    const response = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
      {},
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64')}`,
        },
      }
    );

    zoomAccessToken = response.data.access_token;
    // Zoom tokens expire in 1 hour (3600 seconds). We'll refresh it a bit earlier.
    tokenExpiresAt = new Date(new Date().getTime() + (response.data.expires_in - 300) * 1000);

    console.log('Successfully fetched new Zoom access token.');
    return zoomAccessToken;
  } catch (error) {
    console.error('Error getting Zoom access token:', error.response ? error.response.data : error.message);
    throw new Error('Failed to get Zoom access token.');
  }
};

export const createZoomMeeting = async (event) => {
  const accessToken = await getZoomAccessToken();

  try {
    const response = await axios.post(
      'https://api.zoom.us/v2/users/me/meetings',
      {
        topic: event.title,
        type: 2, // Scheduled meeting
        start_time: event.startTime,
        duration: event.duration,
        timezone: 'UTC',
        settings: {
          // Use settings from the event form, with sensible defaults
          waiting_room: event.zoomSettings?.waiting_room ?? true,
          host_video: event.zoomSettings?.host_video ?? false,
          participant_video: event.zoomSettings?.participant_video ?? false,
          mute_upon_entry: event.zoomSettings?.mute_upon_entry ?? true,
          join_before_host: event.zoomSettings?.join_before_host ?? false,
          jbh_time: event.zoomSettings?.join_before_host ? event.zoomSettings?.jbh_time : undefined,
          watermark: false,
          use_pmi: false,
          approval_type: 0, // Automatically approve
          audio: 'both',
          auto_recording: event.zoomSettings?.auto_recording ?? 'none',
          meeting_authentication: event.zoomSettings?.meeting_authentication ?? true,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating Zoom meeting:', error.response ? error.response.data : error.message);
    throw new Error('Failed to create Zoom meeting.');
  }
};
