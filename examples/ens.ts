import * as ens from '../src/utils/ensResolve';

const names = ['michaelhahn.eth'];

names.forEach(async name => {
    const address = await ens.resolve(name);
    console.log(name + ': ' + address);
});
