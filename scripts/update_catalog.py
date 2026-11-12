#!/usr/bin/env python3
"""Refresh the public layer catalogue; never retain the source viewer's proxy tokens."""
import datetime
import html
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request

SOURCE = 'https://rce.webgis.nl/nl/map/erfgoedatlas'
ROOT = pathlib.Path(__file__).resolve().parents[1]

def safe_url(value):
    if not value:
        return None
    u = urllib.parse.urlsplit(html.unescape(value))
    if u.scheme != 'https' or u.username or re.search(r'(token|apikey|api_key|jwt|password)', u.query, re.I):
        return None
    return urllib.parse.urlunsplit(u)

def build(config):
    layers = {}
    for key, layer in config['layers'].items():
        service = config['services'][layer['service']]
        kind = service['servicetype']
        style = layer.get('style') or {}
        url = safe_url(service.get('url'))
        crss = layer.get('projections') or {}
        crs = next((c for c in ['EPSG:28992','EPSG:3857','EPSG:4326'] if c in crss), None)
        supported = kind == 'WMS' and bool(crs) and bool(url)
        item = dict(id=key, title=layer['title'], type=kind, url=url,
                    name=layer['layername'], style=style.get('style') or '',
                    opacity=(style.get('opacity') or 100)/100,
                    version=service.get('version') or '1.3.0', projection=crs,
                    minResolution=layer.get('resolutionMin'), maxResolution=layer.get('resolutionMax'),
                    legend=safe_url(style.get('legendUrl')), supported=supported,
                    featureInfoJson='application/json' in (layer.get('infoFormats') or []))
        metadata = layer.get('metadata') or {}
        links = [safe_url(u) for u in re.findall(r'href=[\"\']([^\"\']+)', metadata.get('description') or '')]
        item['links'] = list(dict.fromkeys(u for u in links if u))[:5]
        if safe_url(metadata.get('metadataUrl')):
            item['links'].insert(0, safe_url(metadata['metadataUrl']))
        if kind == 'WMTS':
            grids = service.get('tileMatrixSets') or {}
            chosen = next(((k,v) for k,v in grids.items() if (v.get('supportedCRS') or '').endswith('28992')), None)
            if not chosen:
                chosen = next(((k,v) for k,v in grids.items() if (v.get('supportedCRS') or '').endswith('3857')), None)
            if chosen and url:
                grid_id, grid = chosen
                item.update(supported=True, matrixSet=grid_id,
                            projection='EPSG:28992' if grid['supportedCRS'].endswith('28992') else 'EPSG:3857',
                            matrices=[dict(id=m['identifier'], origin=m['topLeftCorner'],
                                           resolution=m['scaleDenominator']*0.00028,
                                           size=[m['tileWidth'],m['tileHeight']]) for m in grid['tileMatrices']])
                resources = [r for r in (layer.get('resourceUrls') or []) if r.get('resourceType') == 'tile' and safe_url(r.get('template'))]
                if resources:
                    item['template'] = safe_url(resources[0]['template'])
                    item['format'] = resources[0]['format']
                else:
                    item['format'] = (layer.get('formats') or ['image/png'])[0]
        if service.get('hasAuth'):
            item['supported'] = False
        if not item['supported']:
            item['style'] = ''
            item['reason'] = 'Deze laag gebruikt een andere service. Bekijk deze in de oorspronkelijke Erfgoedatlas.'
        layers[key] = item
    # PDOK's current canonical endpoint replaces its legacy redirect.
    for item in layers.values():
        for field in ['url','template']:
            if item.get(field):
                item[field] = item[field].replace('service.pdok.nl/brt/achtergrondkaart/', 'service.pdok.nl/kadaster/brt-achtergrondkaart/')
    tree = {key: {k:node.get(k) for k in ['title','children','layer','visibleInViewerTree']} for key,node in config['tree'].items()}
    return dict(source=SOURCE, updated=datetime.date.today().isoformat(),
                projection=config['map']['proj4text'].strip(), root=str(config['treeRoot']),
                layers=layers, tree=tree,
                supportedCount=sum(bool(x['supported']) for x in layers.values()), totalCount=len(layers))

def main():
    if len(sys.argv) > 1:
        config=json.loads(pathlib.Path(sys.argv[1]).read_text())
    else:
        content=urllib.request.urlopen(SOURCE, timeout=45).read().decode('utf-8')
        marker='var mapConfig = '
        config,_=json.JSONDecoder().raw_decode(content[content.index(marker)+len(marker):])
    result=build(config)
    webroot=ROOT/'dist' if (ROOT/'dist').is_dir() else ROOT
    target=webroot/'assets/catalog.js'
    target.write_text('window.ATLAS_CATALOG = '+json.dumps(result, ensure_ascii=False, separators=(',',':'))+';\n', encoding='utf-8')
    print(f"{result['supportedCount']} raster layers / {result['totalCount']} catalogue entries: {target}")

if __name__ == '__main__':
    main()
