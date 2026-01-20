import Group from '../src/models/group.js';

/**
 * set last active time for a group
 * @param {number} gid
 * @return {Promise<void>}
 */
const setLastActive = async (gid) => {
  await Group.findOneAndUpdate({ gid }, { lastActiveAt: new Date() }, { upsert: true });
};

/** 
 * get inactive groups
 * @param {number} daysPass 
 * @returns {Promise<Array>}
 */
const getInactiveGroups = async (daysPass) => {
  const groups = await Group.aggregate([
    {
      $project: {
        gid: '$gid',
        days: {
          $dateDiff: {
            startDate: '$lastActiveAt',
            endDate: '$$NOW',
            unit: 'day'
          }
        }
      }
    },
    { $match: { days: { $gt: daysPass } } }
  ]);

  return groups;
};

/**
 * delete group by gid
 * @param {number} gid
 * @returns {Promise<void>} 
 */
const deleteGroup = async (gid) => {
  await Group.findOneAndDelete({ gid });
};

/**
 * refresh unset group activity
 * @param {import ("wolf.js").WOLF} api
 * @returns {Promise<Array>}
 */
const refreshUnsetGroup = async (api) => {
  const groups = await api.channel().list();
  const groupsNames = groups.reduce(async (pv, group) => {
    const names = await pv;

    await setLastActive(group.id);

    return [...names, `[${group.name}]`];
  }, []);

  return groupsNames;
};

export { deleteGroup, getInactiveGroups, refreshUnsetGroup, setLastActive };

