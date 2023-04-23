# opengluck-webhook-episode-alert

This repository sends notifications when you have are in an episode for a
while, and it has not cleared.

## Configuration

Checkout both this repository and `diably-apn` in the same directory, and
configure APNs in the latter module.

### Webhooks

Install this webhook in opengluck for the `Glucose Episode Changed
Webhook`:
http://host.docker.internal:6503/episode-changed
