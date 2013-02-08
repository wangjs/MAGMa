/**
 * Fieldset with ms data upload options.
 *
 * @author <a href="mailto:s.verhoeven@esciencecenter.nl">Stefan Verhoeven</a>
 */
Ext.define('Esc.magmaweb.view.scan.UploadFieldSet', {
	extend : 'Ext.form.Panel',
    alias: 'widget.uploadmsdatafieldset',
    requires: [
         'Esc.form.field.TextareaTab',
         'Ext.form.field.ComboBox',
         'Ext.form.field.Number',
         'Ext.form.field.File',
         'Ext.container.Container'
    ],
    frame: true,
    bodyPadding: '5',
	defaults : {
	    labelWidth : 200
	},
    items: [{
        xtype: 'combo',
        store: [['mzxml','mzXML'], ['tree', 'Tree']],
        allowBlank: false,
        fieldLabel: 'Format',
        name: 'ms_data_format',
        value: 'mzxml'
    }, {
        xtype : 'textareatab',
        name : 'ms_data',
        id: 'ms_data_area',
        emptyText : 'Enter MS data in Tree format or mzXML',
        height : 200,
        width : 500
    }, {
        xtype: 'container',
        layout: 'hbox',
        items: [{
            xtype: 'button',
            text: 'Load chlorogenic acid example',
            tooltip: 'Loads chlorogenic acid example ms data set and configuration which gives well annotated result',
            action: 'loadmsdataexample'
        }, {
            xtype : 'displayfield',
            flex: 1,
            value : '&nbsp;<a href="help/example">Information on example</a>'
        }]
    }, {
        xtype : 'displayfield',
        value : '<br>or'
    }, {
        name: 'ms_data_file',
        xtype: 'filefield',
        emptyText: 'Upload MS/MS data file',
        width: 300
    }, {
        xtype: 'displayfield',
        value: '<br>Filter options:'
    }, {
        xtype: 'numberfield',
        name: 'max_ms_level',
        labelSeparator: '',
        afterLabelTextTpl: '<span class="relation">&le;</span>',
        fieldLabel: 'MS level',
        tooltip: 'Maximum MS level',
        allowBlank: false,
        minValue: 1,
        maxValue: 15,
        decimalPrecision: 0
    }, {
        xtype: 'numberfield',
        name: 'abs_peak_cutoff',
        fieldLabel: 'Noise filter',
        labelSeparator: '',
        afterLabelTextTpl: '<span class="relation">&lt;</span>',
        tooltip: 'Absolute intensity threshold for storing peaks in database',
        allowBlank: false,
        decimalPrecision: 5
    }]
});
