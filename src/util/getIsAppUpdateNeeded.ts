const APP_VERSION_REGEX = /^\d+\.\d+(\.\d+)?$/;

export default function getIsAppUpdateNeeded(remoteVersion: string, appVersion: string) {
  const sanitizedRemoteVersion = remoteVersion.trim();

  if (!APP_VERSION_REGEX.test(sanitizedRemoteVersion)) {
    return false;
  }

  return sanitizedRemoteVersion.localeCompare(appVersion, undefined, { numeric: true, sensitivity: 'base' }) === 1;
}
