/**
 * MSpectras controller.
 *
 * Handles actions performed on the mspectra views.
 *
 * @author <a href="mailto:s.verhoeven@esciencecenter.nl">Stefan Verhoeven</a>
 */
Ext.define('Esc.magmaweb.controller.MSpectras', {
  extend: 'Ext.app.Controller',
  requires: ['Esc.d3.MSpectra'],
  config: {
    /**
     * Maximum MS level or nr of MS levels.
     * @cfg {Number}
     */
    maxmslevel: null,
    /**
     * MSpectra endpoint.
     * Tokenized string with scanid and mslevel tokens.
     * @cfg {String}
     */
    url: null
  },
  /**
   * @property {Array} mspectras Array of Ext.esc.MSpectra
   * Index is MS level.
   */
  mspectras: [],
  /**
   * @property {Number} Mz of selected lvl1 peak
   */
  selectedMolecule: null,
  constructor: function(config) {
    this.initConfig(config);
    this.callParent(arguments);
    return this;
  },
  init: function() {
    var me = this;
    this.setUrl(this.application.getUrls().mspectra);
    this.setMaxmslevel(this.application.getMaxmslevel());

    this.application.on('selectscan', this.loadMSpectra1, this);
    this.application.on('fragmentexpand', this.loadMSpectraFromFragment, this);
    this.application.on('fragmentload', this.loadMSpectrasFromFragment, this);
    this.application.on('fragmentselect', this.selectPeakFromFragment, this);
    this.application.on('fragmentdeselect', this.deselectPeakFromFragment, this);
    this.application.on('noselectscan', this.clearMSpectra1, this);
    this.application.on('mzandmoleculenoselect', this.clearMSpectraFrom2, this);
    this.application.on('fragmentcollapse', this.clearMSpectraFromFragment, this);
    this.application.on('mspectraload', function(scanid, mslevel) {
      Ext.getCmp('mspectra' + mslevel + 'panel').header.setTitle('Level ' + mslevel + ' scan ' + scanid);
    });
    this.application.on('mspectraclear', function(mslevel) {
      Ext.getCmp('mspectra' + mslevel + 'panel').header.setTitle('Level ' + mslevel + ' scan ...');
    });
    this.application.on('peakmouseover', function(peak, mslevel, scanid) {
      Ext.getCmp('mspectra' + mslevel + 'panel').header.setTitle('Level ' + mslevel + ' scan ' + scanid + ' (m/z=' + peak.mz + ', intensity=' + peak.intensity + ')');
    });
    this.application.on('assignmentchanged', function(isAssigned, params) {
      var mspectra = me.getMSpectra(1);
      mspectra.setAssignment(isAssigned, params.molid);
    }, this);
    this.application.on('moleculeselect', this.selectPeakOfMolecule, this);
    this.application.on('moleculedeselect', this.deselectPeakOfMolecule, this);
    this.application.on('moleculereselect', this.selectPeakOfMolecule, this);

    this.addEvents(
      /**
       * @event
       * Triggered when a peak in a MSpectra is selected.
       * @param {Number} mz M/z of selected peak
       * @param {Number} mslevel MS level where peak is located
       */
      'peakselect',
      /**
       * @event
       * Triggered when a peak in a MSpectra is deselected.
       * @param {Number} mz M/z of selected peak
       * @param {Number} mslevel MS level where peak is located
       */
      'peakdeselect',
      /**
       * @event
       * Triggered when a mspectra is loaded from the server
       * @param {Number} scanid Scan identifier
       * @param {Number} mslevel MS level of scan
       */
      'mspectraload',
      /**
       * @event
       * Triggered when a mspectra is cleared
       * @param {Number} mslevel MS level of scan
       */
      'mspectraclear',
      /**
       * @event
       * Fires when mouse is moved over a vertical line of a mspectra
       * @param {Object} peak
       * @param {Number} peak.mz M/z of peak
       * @param {Number} peak.intensity Intensity of peak.
       * @param {Number} mslevel MS level of scan
       * @param {Number} scanid Scan identifier of mspectra which is loaded
       */
      'peakmouseover'
    );

    // register controls foreach mspectra
    for (var mslevel = 1; mslevel <= this.getMaxmslevel(); mslevel++) {
      var centerquery = '#mspectra' + mslevel + 'panel tool[action=center]';
      this.control(centerquery, {
        click: this.center
      });
    }
  },
  /**
   * Initializes MSpectra scan panels
   *
   * @param {Ext.app.Application} app
   */
  onLaunch: function(app) {
    var msspectrapanels = [];
    var listeners = {
      selectpeak: function(mz) {
        app.fireEvent('peakselect', mz, this.mslevel, this.scanid);
      },
      unselectpeak: function(mz) {
        app.fireEvent('peakdeselect', mz, this.mslevel, this.scanid);
      },
      mouseoverpeak: function(peak) {
        app.fireEvent('peakmouseover', peak, this.mslevel, this.scanid);
      }
    };
    for (var mslevel = 1; mslevel <= this.getMaxmslevel(); mslevel++) {
      this.mspectras[mslevel] = Ext.create('Esc.d3.MSpectra', {
        mslevel: mslevel,
        emptyText: (
          mslevel == 1 ?
          'Select a scan in the chromatogram' :
          'Select a fragment to show its level ' + mslevel + ' scan'
        ),
        listeners: listeners
      });
      msspectrapanels.push({
        title: 'Level ' + mslevel + ' scan ...',
        id: 'mspectra' + mslevel + 'panel',
        collapsible: true,
        tools: [{
          type: 'restore',
          tooltip: 'Center level ' + mslevel + ' scan',
          disabled: true,
          action: 'center'
        }, {
          type: 'save',
          disabled: true,
          tooltip: 'Save scan'
        }, {
          type: 'help',
          tooltip: 'Help',
          action: 'help',
          handler: this.showHelp,
          scope: this
        }],
        items: this.mspectras[mslevel]
      });
    }
    var panel = Ext.getCmp('mspectrapanel');
    if (this.getMaxmslevel() > 0) {
      // Each scan panel has header with title, hide parent header for extra room
      panel.getHeader().hide();
      panel.add(msspectrapanels);
    } else {
      panel.update('No scans available: Upload ms data');
    }
  },
  /**
   * Return MSpectra view based on MS level
   * @param {Number} mslevel
   */
  getMSpectra: function(mslevel) {
    return this.mspectras[mslevel];
  },
  /**
   * Load a MSpectra.
   * Clears all mspectras with higher mslevel
   *
   * @param {Number} mslevel MS level
   * @param {Number} scanid Scan identifier.
   * @param {Array} markers Array of markers to add after Mspectra is loaded.
   * @param {Boolean} clearHigherSpectra True to clear all higher level mspectra.
   */
  loadMSpectra: function(mslevel, scanid, markers, clearHigherSpectra) {
    var me = this;
    Ext.log({}, 'Loading msspectra level ' + mslevel + ' with id ' + scanid);
    var mspectra = this.getMSpectra(mslevel);
    if (mspectra.scanid === scanid) {
      // dont load mspectra if it already loaded
      return;
    }
    if (mslevel === 1 && mspectra.scanid) {
      // clear lvl1 spectra if another scan is already loaded
      // deselect possibly selected peaks
      this.clearMSpectra1();
    }
    mspectra.scanid = scanid;
    mspectra.setLoading(true);
    if (clearHigherSpectra) {
      this.clearMSpectraFrom(mslevel + 1); // TODO stop this when (un)assinging a structure to a peak
    }
    d3.json(
      Ext.String.format(this.getUrl(), scanid, mslevel),
      function(data) {
        me.onLoadMSpectra(mslevel, scanid, markers, data);
      }
    );
  },
  /**
   * onLoad a MSpectra.
   *
   * @param {Number} mslevel MS level
   * @param {Number} scanid Scan identifier.
   * @param {Array} markers Array of markers to add after Mspectra is loaded.
   * @param {Object} data
   * @param {Array} data.peaks Array of peaks of scan
   * @param {Number} data.cutoff Cutoff of this scan (based on basepeak intensity and msms intensity cutoff ratio)
   */
  onLoadMSpectra: function(mslevel, scanid, markers, data) {
    var mspectra = this.getMSpectra(mslevel);
    if (!data) {
      Ext.Error.raise({
        msg: 'Unable to find mspectra scan on level ' + mslevel + ' with id ' + scanid
      });
      return;
    }
    mspectra.setLoading(false);
    mspectra.cutoff = data.cutoff;
    mspectra.setData(data.peaks);
    if (mslevel === 1) {
      // level one gets markers from server
      mspectra.setMarkers(data.fragments);
      // select peak if there is only one with fragments
      if (data.fragments.length === 1) {
        Ext.log({}, 'peakselect one peak with fragments', data.fragments[0].mz, mslevel, scanid);
        mspectra.selectPeak(data.fragments[0].mz);
        this.application.fireEvent('peakselect', data.fragments[0].mz, mslevel, scanid);
      }
      if (this.selectedMolecule && this.selectedMolecule.data.mz !== mspectra.selectedpeak) {
        // if molecule was selected then select the peak with the molecule mz
        if (mspectra.selectPeak(this.selectedMolecule.data.mz)) {
          this.application.fireEvent('peakselect', this.selectedMolecule.data.mz, mslevel, scanid);
        } else {
          Ext.log({}, 'Unable to select peak from selected molecule');
        }
      }
    } else {
      // level >1 gets markers from selected fragment
      mspectra.setMarkers(markers);
    }
    mspectra.up('panel').down('tool[action=center]').enable();
    this.application.fireEvent('mspectraload', scanid, mslevel);
  },
  /**
   * Load a lvl1 MSpectra
   *
   * @param {Number} scanid Scan identifier.
   */
  loadMSpectra1: function(scanid) {
    this.loadMSpectra(1, scanid, [], true);
  },
  /**
   * Load a lvl2 MSpectra
   *
   * @param {Number} scanid Scan identifier.
   * @param {Array} markers Array of markers to add after Mspectra is loaded.
   */
  loadMSpectra2: function(scanid, markers) {
    this.loadMSpectra(2, scanid, markers, true);
  },
  /**
   * Loads a MSpectra of a fragment.
   *
   * @param {Esc.magmaweb.model.Fragment} fragment MSpectra of fragments firstchild  is loaded
   */
  loadMSpectraFromFragment: function(fragment) {
    var mslevel = fragment.firstChild.data.mslevel;
    var scanid = fragment.firstChild.data.scanid;
    var mspectra = this.getMSpectra(mslevel);
    // skip if mspectra already has same scan
    if (mspectra.scanid != scanid) {
      this.loadMSpectra(
        mslevel, scanid,
        fragment.childNodes.map(function(r) {
          return {
            mz: r.data.mz
          };
        }),
        true
      );
    }
  },
  /**
   * Depending on which mslevel the fragment was found and if has children
   * MSpectra are loaded and peaks selected.
   *
   * @param {Esc.magmaweb.model.Fragment} parent
   * @param {Array} children child fragments
   */
  loadMSpectrasFromFragment: function(parent, children) {
    if (parent.isRoot()) {
      // lvl1 fragment
      Ext.log({}, 'loading lvl2 mspectra');
      // load optional child lvl2 scans
      var molecule_fragment = parent.firstChild;
      if (molecule_fragment.hasChildNodes()) {
        this.loadMSpectra2(
          molecule_fragment.firstChild.data.scanid,
          molecule_fragment.childNodes.map(
            function(d) {
              return {
                mz: d.data.mz
              };
            }
          )
        );
      }
    } else {
      // lvl >1 fragment
      Ext.log({}, 'Select peak of fragment');
      this.getMSpectra(parent.data.mslevel).selectPeak(parent.data.mz);
    }
  },
  /**
   * Clear a MSpesctra.
   *
   * @param {Number} mslevel Level of MSpectra to clear
   */
  clearMSpectra: function(mslevel) {
    var mspectra = this.getMSpectra(mslevel);
    if (!mspectra.scanid) {
      // don't clear a already cleared mspectra
      return;
    }
    mspectra.setData([]);
    mspectra.scanid = false;
    this.application.fireEvent('mspectraclear', mslevel);
    mspectra.up('panel').down('tool[action=center]').disable();
  },
  /**
   * Clear MSpectra lvl 1
   */
  clearMSpectra1: function() {
    var mspectra = this.getMSpectra(1);
    if (mspectra.selectedpeak) {
      // unselect peak when loading another scan
      mspectra.clearPeakSelection();
    }
    this.clearMSpectra(1);
  },
  /**
   * @param {Number} mslevel This mspectra lvl is clear plus any higher lvl mspectra
   * @private
   */
  clearMSpectraFrom: function(mslevel) {
    for (var i = mslevel; i <= this.getMaxmslevel(); i++) {
      this.clearMSpectra(i);
    }
  },
  /**
   * Clears all mspectra >=lvl2 and clears lvl1 markers
   */
  clearMSpectraFrom2: function() {
    this.clearMSpectraFrom(2);
  },
  /**
   * When fragment is collapsed the mspectra of its children must be cleared.
   * @param {Esc.magmaweb.model.Fragment} fragment
   */
  clearMSpectraFromFragment: function(fragment) {
    this.clearMSpectraFrom(fragment.data.mslevel + 1);
  },
  /**
   * Select a peak using a fragment.
   * Peaks of fragments parents are also selected.
   * And peaks in child mspectras are unselected
   *
   * @param {Esc.magmaweb.model.Fragment} fragment Fragment of peak to select.
   */
  selectPeakFromFragment: function(fragment) {
    var mslevel = fragment.data.mslevel;
    this.getMSpectra(mslevel).selectPeak(fragment.data.mz);
    // clear selection in child mspectra
    for (var i = mslevel + 1; i <= this.getMaxmslevel(); i++) {
      this.getMSpectra(i).clearPeakSelection();
    }
    // select parent peaks
    if (mslevel == 3) {
      this.getMSpectra(2).selectPeak(fragment.parentNode.data.mz);
    } else if (mslevel > 3) {
      // TODO use recursive func to select parent peaks
    }
  },
  /**
   * Deselect a peak using a fragment.
   *
   * @param {Esc.magmaweb.model.Fragment} fragment Fragment of peak to deselect.
   */
  deselectPeakFromFragment: function(fragment) {
    this.getMSpectra(fragment.data.mslevel).clearPeakSelection();
  },
  center: function(tool) {
    var mspectra = tool.up('panel').down('mspectra');
    mspectra.resetScales();
  },
  showHelp: function() {
    this.application.showHelp('scan');
  },
  /**
   * Select the peak in the lvl 1 scan where the selected molecule has a fragment
   */
  selectPeakOfMolecule: function(molid, molecule) {
    if (molecule.data.mz === 0) {
      // Molecules with mz has not been loaded yet,
      // delaying peak selection until molecule is reselected
      return;
    }
    var mslevel = 1;
    var mspectra = this.getMSpectra(mslevel);
    this.selectedMolecule = molecule;
    if (!mspectra.scanid) {
      // skip in no lvl1 scan is selected
      return;
    }
    if (mspectra.selectedpeak === molecule.data.mz) {
      // dont select same mz again
      return;
    }
    if (mspectra.selectPeak(molecule.data.mz)) {
      this.application.fireEvent('peakselect', molecule.data.mz, mslevel, mspectra.scanid);
    }
  },
  deselectPeakOfMolecule: function() {
    this.selectedMolecule = null;
    // dont deselect peak in spectra as user might want to select another molecule with the same mz
  }
});
