from sygma.models import DBSession
from sygma.models import Metabolite, Scan, Peak, Fragment
from pyramid.response import Response
from pyramid.view import view_config
from sqlalchemy.sql.expression import desc, asc
from sqlalchemy.sql import exists
import simplejson as json

@view_config(route_name='home', renderer='templates/results.pt')
def index(request):
    return { 'cutoff': 200000 }

def extjsgridfilter(q,column,filter):
    if (filter['type'] == 'numeric'):
        if (filter['comparison'] == 'eq'):
            return q.filter(column==filter['value'])
        if (filter['comparison'] == 'gt'):
            return q.filter(column>filter['value'])
        if (filter['comparison'] == 'lt'):
            return q.filter(column<filter['value'])
    elif (filter['type'] == 'string'):
        return q.filter(column.contains(filter['value']))
    elif (filter['type'] == 'list'):
        return q.filter(column.in_(filter['value']))
    elif (filter['type'] == 'boolean'):
        return q.filter(column==filter['value'])

@view_config(route_name='metabolites.json', renderer='json')
def metabolitesjson(request):
    dbsession = DBSession()
    mets = []
    start = int(request.params['start'])
    limit = int(request.params['limit'])
    q = dbsession.query(Metabolite)

    # custom filters
    if ('scanid' in request.params):
        # TODO add score column + order by score
        q = q.join(Fragment.metabolite).filter(Fragment.parentfragid==0).filter(Fragment.scanid==request.params['scanid'])
    if ('metid' in request.params):
        q = q.filter(Metabolite.metid==request.params['metid'])

    if ('filter' in request.params):
        for filter in json.loads(request.params['filter']):
            # generic filters
            q = extjsgridfilter(q, Metabolite.__dict__[filter['field']], filter)

    total = q.count()

    if ('sort' in request.params):
        for col in json.loads(request.params['sort']):
            if (col['direction'] == 'DESC'):
                q = q.order_by(desc(Metabolite.__dict__[col['property']]))
            elif (col['direction'] == 'ASC'):
                q = q.order_by(asc(Metabolite.__dict__[col['property']]))
    else:
        # default sort
        q = q.order_by(desc(Metabolite.probability), Metabolite.metid)

    for met in q[start:(limit+start)]:
        r = {
            'metid': met.metid,
            'mol': met.mol,
            'level': met.level,
            'probability': met.probability,
            'reactionsequence': met.reactionsequence,
            'smiles': met.smiles,
            'molformula': met.molformula,
            'isquery': met.isquery,
            'origin': met.origin,
            'nhits': met.nhits
        }
        mets.append(r)

    return { 'total': total, 'rows': mets }

@view_config(route_name='chromatogram.json', renderer='json')
def chromatogramjson(request):
    dbsession = DBSession()
    scans = []
    # TODO add left join to find if scan has metabolite hit
    for scan in dbsession.query(Scan).filter_by(mslevel=1):
        scans.append({
            'id': scan.scanid,
            'rt': scan.rt,
            'intensity': scan.basepeakintensity,
            'hashit': False
        })

    return scans

@view_config(route_name='chromatogram/hits.json', renderer='json')
def chromatogram_hits(request):
    dbsession = DBSession()
    # only metabolite fragment hits
    fq = DBSession.query(Fragment.scanid).filter(Fragment.parentfragid==0)

    if ('metid' in request.params):
        fq.filter(Fragment.metid==request.params['metid'])

    hits = []
    # only scans which are level 1 and have a metabolite hit
    for hit in dbsession.query(Scan.rt,Scan.scanid).filter_by(mslevel=1).filter(Scan.scanid.in_(fq)):
        hits.append({
            'id': hit.scanid,
            'rt': hit.rt,
        })

    return hits

@view_config(route_name='mspectra.json', renderer='json')
def mspectrajson(request):
    dbsession = DBSession()
    peaks = []
    for peak in dbsession.query(Peak).filter_by(scanid=request.matchdict['id']):
        peaks.append({
            'mz': peak.mz,
            'intensity': peak.intensity
        })

    return peaks

@view_config(route_name='scantree.json', renderer='json')
def scantree(request):
    return {}

@view_config(route_name='metabolite/scans.json', renderer='json')
def metabolitescans(request):
    metid = request.matchdict['id']
    scans = []
    for frag in DBSession().query(Fragment.scanid).filter(Fragment.metid==metid).filter(Fragment.parentfragid==0):
        scans.append(frag.scanid)
    return scans

@view_config(route_name='fragments.json', renderer='json')
def fragments(request):
    q = DBSession().query(Fragment,Metabolite.mol).join(Metabolite).filter(
        Fragment.scanid==request.matchdict['scanid']).filter(
        Fragment.metid==request.matchdict['metid'])

    # parent metabolite
    if (request.params['node'] == 'root'):
        (frag, mol) = q.filter(Fragment.parentfragid==0).one()
        f = {
            'fragid': frag.fragid,
            'scanid': frag.scanid,
            'metid': frag.metid,
            'score': frag.score,
            'mol': mol,
            'atoms': frag.atoms,
            'mz': frag.mz,
            'mass': frag.mass,
            'deltah': frag.deltah,
        }
        if (len(frag.children)>0):
            f['expanded'] = False
            f['leaf'] = False
        else:
            f['expanded'] = True
            f['leaf'] = True
        return { 'children': f, 'expanded': True}
